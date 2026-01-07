import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getLogoPath } from "@/lib/settings"
import puppeteer from "puppeteer"
import { readFile } from "fs/promises"
import { join } from "path"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        client: true,
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            person: {
              select: {
                name: true,
                email: true,
              },
            },
            milestones: true,
          },
          orderBy: { createdAt: "asc" },
        },
        milestones: {
          orderBy: { createdAt: "asc" },
        },
        tags: true,
        paymentTerms: true,
        approvals: {
          include: {
            approver: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    // Check if client can access this proposal
    if (session.user.role === "CLIENT") {
      const client = await prisma.client.findFirst({
        where: { 
          email: session.user.email,
          deletedAt: null, // Exclude deleted clients
        },
      })
      if (!client || proposal.clientId !== client.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Allow PDF download for any proposal status (no restriction)
    // Users can download PDFs of drafts, submitted, approved, or rejected proposals

    // Fetch logo and convert to base64
    let logoBase64: string | null = null
    try {
      const logoPath = await getLogoPath()
      if (logoPath) {
        const fullPath = join(process.cwd(), "public", logoPath)
        const logoBuffer = await readFile(fullPath)
        const logoExtension = logoPath.split(".").pop()?.toLowerCase() || "png"
        const mimeType = logoExtension === "svg" ? "image/svg+xml" : 
                        logoExtension === "jpg" || logoExtension === "jpeg" ? "image/jpeg" : 
                        "image/png"
        logoBase64 = `data:${mimeType};base64,${logoBuffer.toString("base64")}`
      }
    } catch (error) {
      console.error("Error loading logo for PDF:", error)
      // Continue without logo if there's an error
    }

    // Generate HTML for PDF
    const html = generateProposalHTML(proposal, logoBase64)

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    const page = await browser.newPage()
    
    // Set content and wait for any dynamic content
    await page.setContent(html, { waitUntil: 'networkidle0' })
    
    // Generate PDF
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    })

    await browser.close()

    // Return PDF (convert Uint8Array to Buffer for NextResponse)
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="proposal-${proposal.proposalNumber || proposal.id}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error("Error generating PDF:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}

function generateProposalHTML(proposal: any, logoBase64: string | null): string {
  const currencySymbol = proposal.currency === 'EUR' ? '€' : 
                        proposal.currency === 'USD' ? '$' : 
                        proposal.currency === 'GBP' ? '£' : proposal.currency

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Proposal ${proposal.proposalNumber || proposal.id}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          .logo-container {
            margin-bottom: 20px;
            text-align: left;
          }
          .logo-container img {
            max-height: 80px;
            max-width: 200px;
            object-fit: contain;
          }
          .header {
            border-bottom: 2px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #2563eb;
            margin: 0;
          }
          .section {
            margin-bottom: 30px;
          }
          .section h2 {
            color: #111827;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 20px;
          }
          .info-item {
            margin-bottom: 10px;
          }
          .info-label {
            font-weight: bold;
            color: #6b7280;
            font-size: 0.9em;
          }
          .info-value {
            color: #111827;
            margin-top: 5px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
          }
          table th,
          table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
          }
          table th {
            background-color: #f9fafb;
            font-weight: bold;
            color: #111827;
          }
          .text-right {
            text-align: right;
          }
          .total {
            font-size: 1.2em;
            font-weight: bold;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
          }
          .milestone {
            background-color: #f9fafb;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 10px;
          }
          .milestone h3 {
            margin: 0 0 10px 0;
            color: #111827;
          }
        </style>
      </head>
      <body>
        ${logoBase64 ? `
        <div class="logo-container">
          <img src="${logoBase64}" alt="Company Logo" />
        </div>
        ` : ''}
        <div class="header">
          <h1>${proposal.title}</h1>
          ${proposal.proposalNumber ? `<p><strong>Proposal Number:</strong> ${proposal.proposalNumber}</p>` : ''}
        </div>

        <div class="section">
          <h2>Client Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Client Name</div>
              <div class="info-value">${proposal.client.name}</div>
            </div>
            ${proposal.client.company ? `
            <div class="info-item">
              <div class="info-label">Company</div>
              <div class="info-value">${proposal.client.company}</div>
            </div>
            ` : ''}
            ${proposal.client.email ? `
            <div class="info-item">
              <div class="info-label">Email</div>
              <div class="info-value">${proposal.client.email}</div>
            </div>
            ` : ''}
            <div class="info-item">
              <div class="info-label">Created By</div>
              <div class="info-value">${proposal.creator.name}</div>
            </div>
            ${proposal.issueDate ? `
            <div class="info-item">
              <div class="info-label">Issue Date</div>
              <div class="info-value">${new Date(proposal.issueDate).toLocaleDateString()}</div>
            </div>
            ` : ''}
            ${proposal.expiryDate ? `
            <div class="info-item">
              <div class="info-label">Expiry Date</div>
              <div class="info-value">${new Date(proposal.expiryDate).toLocaleDateString()}</div>
            </div>
            ` : ''}
          </div>
        </div>

        ${proposal.description ? `
        <div class="section">
          <h2>Description</h2>
          <p>${proposal.description}</p>
        </div>
        ` : ''}

        ${proposal.items && proposal.items.length > 0 ? `
        <div class="section">
          <h2>Line Items</h2>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Person</th>
                <th>Quantity</th>
                <th>Rate/Price</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${proposal.items.map((item: any) => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.person ? item.person.name : '-'}</td>
                  <td>${item.quantity || '-'}</td>
                  <td>${item.rate || item.unitPrice ? `${currencySymbol}${(item.rate || item.unitPrice || 0).toFixed(2)}` : '-'}</td>
                  <td class="text-right">${currencySymbol}${item.amount.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${proposal.milestones && proposal.milestones.length > 0 ? `
        <div class="section">
          <h2>Milestones</h2>
          ${proposal.milestones.map((milestone: any) => `
            <div class="milestone">
              <h3>${milestone.name}</h3>
              ${milestone.description ? `<p>${milestone.description}</p>` : ''}
              ${milestone.amount ? `<p><strong>Amount:</strong> ${currencySymbol}${milestone.amount.toFixed(2)}</p>` : ''}
              ${milestone.percent ? `<p><strong>Percentage:</strong> ${milestone.percent}%</p>` : ''}
              ${milestone.dueDate ? `<p><strong>Due Date:</strong> ${new Date(milestone.dueDate).toLocaleDateString()}</p>` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}

        ${proposal.amount ? `
        <div class="section">
          <div class="total">
            <div class="text-right">
              <div>Total Amount: ${currencySymbol}${proposal.amount.toFixed(2)}</div>
              ${proposal.taxRate ? `
                <div>Tax (${proposal.taxRate}%): ${currencySymbol}${(proposal.amount * proposal.taxRate / 100).toFixed(2)}</div>
                <div>Total with Tax: ${currencySymbol}${(proposal.amount * (1 + proposal.taxRate / 100)).toFixed(2)}</div>
              ` : ''}
            </div>
          </div>
        </div>
        ` : ''}

        ${proposal.paymentTerms && proposal.paymentTerms.length > 0 ? `
        <div class="section">
          <h2>Payment Terms</h2>
          ${proposal.paymentTerms.map((term: any, index: number) => `
            <div style="margin-bottom: 20px;">
              <h3>Payment Term ${index + 1}</h3>
              ${term.upfrontType && term.upfrontValue ? `
                <p><strong>Upfront Payment:</strong> ${term.upfrontType === 'PERCENT' ? `${term.upfrontValue}%` : `${currencySymbol}${term.upfrontValue.toFixed(2)}`}</p>
              ` : ''}
              ${term.installmentType ? `
                <p><strong>Installment Type:</strong> ${term.installmentType}</p>
              ` : ''}
              ${term.installmentCount && term.installmentFrequency ? `
                <p><strong>Installments:</strong> ${term.installmentCount} payments, ${term.installmentFrequency}</p>
              ` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}
      </body>
    </html>
  `
}

