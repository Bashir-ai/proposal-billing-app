export const dynamic = 'force-dynamic'
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

    const bill = await prisma.bill.findUnique({
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
          },
          orderBy: { createdAt: "asc" },
        },
        proposal: {
          select: {
            id: true,
            title: true,
            proposalNumber: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
        paymentDetails: {
          select: {
            id: true,
            name: true,
            details: true,
          },
        },
      },
    })

    if (!bill) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Check if client can access this invoice
    if (session.user.role === "CLIENT") {
      const client = await prisma.client.findFirst({
        where: { 
          email: session.user.email,
          deletedAt: null,
        },
      })
      if (!client || bill.clientId !== client.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

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
    const html = generateInvoiceHTML(bill, logoBase64)

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

    // Return PDF
    const filename = bill.invoiceNumber 
      ? `invoice-${bill.invoiceNumber}.pdf`
      : `invoice-${bill.id}.pdf`

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
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

function generateInvoiceHTML(bill: any, logoBase64: string | null): string {
  const currency = bill.project?.currency || bill.proposal?.currency || "EUR"
  const currencySymbol = currency === 'EUR' ? '€' : 
                        currency === 'USD' ? '$' : 
                        currency === 'GBP' ? '£' : currency

  // Calculate totals
  const subtotal = bill.subtotal || bill.items.reduce((sum: number, item: any) => sum + item.amount, 0)
  const discount = bill.discountAmount || (bill.discountPercent ? (subtotal * bill.discountPercent / 100) : 0)
  const afterDiscount = subtotal - discount
  const taxAmount = bill.taxRate && bill.taxRate > 0
    ? (bill.taxInclusive 
        ? (afterDiscount * bill.taxRate / (100 + bill.taxRate))
        : (afterDiscount * bill.taxRate / 100))
    : 0
  const total = bill.amount || (bill.taxInclusive ? afterDiscount : afterDiscount + taxAmount)

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice ${bill.invoiceNumber || bill.id}</title>
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
          .totals {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
          }
          .total-row.total-final {
            font-size: 1.2em;
            font-weight: bold;
            padding-top: 15px;
            border-top: 2px solid #e5e7eb;
            margin-top: 10px;
          }
          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85em;
            font-weight: 600;
            margin-top: 10px;
          }
          .status-DRAFT { background-color: #f3f4f6; color: #374151; }
          .status-SUBMITTED { background-color: #dbeafe; color: #1e40af; }
          .status-APPROVED { background-color: #d1fae5; color: #065f46; }
          .status-PAID { background-color: #d1fae5; color: #065f46; }
        </style>
      </head>
      <body>
        ${logoBase64 ? `
        <div class="logo-container">
          <img src="${logoBase64}" alt="Company Logo" />
        </div>
        ` : ''}
        <div class="header">
          <h1>INVOICE</h1>
          ${bill.invoiceNumber ? `<p><strong>Invoice Number:</strong> ${bill.invoiceNumber}</p>` : ''}
          ${bill.status ? `<span class="status-badge status-${bill.status}">${bill.status}</span>` : ''}
          ${bill.description ? `
            <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border-left: 4px solid #2563eb; border-radius: 4px;">
              <h3 style="margin: 0 0 10px 0; color: #111827; font-size: 1.1em;">Invoice Description</h3>
              <p style="margin: 0; color: #374151; line-height: 1.6;">${bill.description}</p>
            </div>
          ` : ''}
        </div>

        <div class="section">
          <h2>Invoice Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Invoice Date</div>
              <div class="info-value">${new Date(bill.createdAt).toLocaleDateString()}</div>
            </div>
            ${bill.dueDate ? `
            <div class="info-item">
              <div class="info-label">Due Date</div>
              <div class="info-value">${new Date(bill.dueDate).toLocaleDateString()}</div>
            </div>
            ` : ''}
            ${bill.paidAt ? `
            <div class="info-item">
              <div class="info-label">Paid Date</div>
              <div class="info-value">${new Date(bill.paidAt).toLocaleDateString()}</div>
            </div>
            ` : ''}
            ${bill.isUpfrontPayment ? `
            <div class="info-item">
              <div class="info-label">Type</div>
              <div class="info-value">Upfront Payment</div>
            </div>
            ` : ''}
          </div>
        </div>

        <div class="section">
          <h2>Bill To</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Client Name</div>
              <div class="info-value">${bill.client.name}</div>
            </div>
            ${bill.client.company ? `
            <div class="info-item">
              <div class="info-label">Company</div>
              <div class="info-value">${bill.client.company}</div>
            </div>
            ` : ''}
            ${bill.client.email ? `
            <div class="info-item">
              <div class="info-label">Email</div>
              <div class="info-value">${bill.client.email}</div>
            </div>
            ` : ''}
            ${bill.client.phone ? `
            <div class="info-item">
              <div class="info-label">Phone</div>
              <div class="info-value">${bill.client.phone}</div>
            </div>
            ` : ''}
            ${bill.client.address ? `
            <div class="info-item">
              <div class="info-label">Address</div>
              <div class="info-value">${bill.client.address}</div>
            </div>
            ` : ''}
          </div>
        </div>

        ${bill.items && bill.items.length > 0 ? `
        <div class="section">
          <h2>Line Items</h2>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Type</th>
                <th>Person</th>
                ${bill.items.some((item: any) => item.quantity) ? '<th>Quantity</th>' : ''}
                ${bill.items.some((item: any) => item.rate || item.unitPrice) ? '<th>Rate/Price</th>' : ''}
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${bill.items.map((item: any) => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.type || '-'}</td>
                  <td>${item.person ? item.person.name : '-'}</td>
                  ${bill.items.some((i: any) => i.quantity) ? `<td>${item.quantity || '-'}</td>` : ''}
                  ${bill.items.some((i: any) => i.rate || i.unitPrice) ? `<td>${item.rate || item.unitPrice ? `${currencySymbol}${(item.rate || item.unitPrice || 0).toFixed(2)}` : '-'}</td>` : ''}
                  <td class="text-right">${item.isCredit ? '-' : ''}${currencySymbol}${Math.abs(item.amount).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <div class="section">
          <div class="totals">
            ${subtotal > 0 ? `
            <div class="total-row">
              <span>Subtotal:</span>
              <span>${currencySymbol}${subtotal.toFixed(2)}</span>
            </div>
            ` : ''}
            ${discount > 0 ? `
            <div class="total-row">
              <span>Discount${bill.discountPercent ? ` (${bill.discountPercent}%)` : ''}:</span>
              <span>-${currencySymbol}${discount.toFixed(2)}</span>
            </div>
            ` : ''}
            ${bill.taxRate && bill.taxRate > 0 ? `
            <div class="total-row">
              <span>Tax${bill.taxInclusive ? ' (inclusive)' : ''} (${bill.taxRate}%):</span>
              <span>${currencySymbol}${taxAmount.toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="total-row total-final">
              <span>Total:</span>
              <span>${currencySymbol}${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        ${bill.proposal ? `
        <div class="section">
          <h2>Related Proposal</h2>
          <p><strong>${bill.proposal.title}</strong></p>
          ${bill.proposal.proposalNumber ? `<p>Proposal Number: ${bill.proposal.proposalNumber}</p>` : ''}
        </div>
        ` : ''}

        ${bill.project ? `
        <div class="section">
          <h2>Related Project</h2>
          <p><strong>${bill.project.name}</strong></p>
        </div>
        ` : ''}

        ${bill.paymentDetails ? `
        <div class="section" style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
          <h2>Payment Details</h2>
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; border-left: 4px solid #2563eb;">
            <p style="margin: 0; white-space: pre-wrap; line-height: 1.6; color: #111827;">${bill.paymentDetails.details}</p>
          </div>
        </div>
        ` : ''}
      </body>
    </html>
  `
}

