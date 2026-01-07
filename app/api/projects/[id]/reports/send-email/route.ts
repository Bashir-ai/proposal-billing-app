import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendProjectReportEmail } from "@/lib/email"
import { generatePdfFromHTML, getLogoBase64 } from "@/lib/pdf-generator"
import { formatDate, formatCurrency } from "@/lib/utils"

function generateProjectReportHTML(project: any, logoBase64: string | null): string {
  const currency = project.currency || "EUR"
  const currencySymbol = currency === 'EUR' ? '€' : 
                        currency === 'USD' ? '$' : 
                        currency === 'GBP' ? '£' : currency

  const totalHours = project.timesheetEntries.reduce((sum: number, entry: any) => sum + entry.hours, 0)
  const totalBillableHours = project.timesheetEntries
    .filter((entry: any) => entry.billable)
    .reduce((sum: number, entry: any) => sum + entry.hours, 0)
  const totalBilledHours = project.timesheetEntries
    .filter((entry: any) => entry.billed)
    .reduce((sum: number, entry: any) => sum + entry.hours, 0)

  const totalTimesheetAmount = project.timesheetEntries.reduce((sum: number, entry: any) => {
    const amount = entry.hours * (entry.rate || 0)
    return sum + amount
  }, 0)

  const totalCharges = project.charges.reduce((sum: number, charge: any) => sum + charge.amount, 0)
  const totalBilled = project.bills.reduce((sum: number, bill: any) => sum + bill.amount, 0)
  const proposedAmount = project.proposal?.amount || 0
  const variance = proposedAmount - totalBilled

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Project Report: ${project.name}</title>
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
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 30px;
          }
          .summary-card {
            background-color: #f9fafb;
            padding: 15px;
            border-radius: 6px;
            text-align: center;
          }
          .summary-label {
            font-size: 0.85em;
            color: #6b7280;
            margin-bottom: 5px;
          }
          .summary-value {
            font-size: 1.5em;
            font-weight: bold;
            color: #111827;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
          }
          table th,
          table td {
            padding: 8px;
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
          .text-center {
            text-align: center;
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
          <h1>Project Report: ${project.name}</h1>
          <p>Comprehensive project overview and financial summary</p>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">Proposed Amount</div>
            <div class="summary-value">${currencySymbol}${proposedAmount.toFixed(2)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Billed</div>
            <div class="summary-value">${currencySymbol}${totalBilled.toFixed(2)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Hours</div>
            <div class="summary-value">${totalHours.toFixed(1)}</div>
            <div style="font-size: 0.8em; color: #6b7280; margin-top: 5px;">
              ${totalBillableHours.toFixed(1)} billable
            </div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Variance</div>
            <div class="summary-value" style="color: ${variance >= 0 ? '#10b981' : '#ef4444'};">
              ${currencySymbol}${variance.toFixed(2)}
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Client Information</h2>
          <p><strong>Client Name:</strong> ${project.client.name}</p>
          ${project.client.company ? `<p><strong>Company:</strong> ${project.client.company}</p>` : ''}
          ${project.client.email ? `<p><strong>Email:</strong> ${project.client.email}</p>` : ''}
        </div>

        ${project.timesheetEntries && project.timesheetEntries.length > 0 ? `
        <div class="section">
          <h2>Timesheet Entries (${project.timesheetEntries.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>User</th>
                <th class="text-right">Hours</th>
                <th class="text-right">Rate</th>
                <th class="text-right">Amount</th>
                <th class="text-center">Billable</th>
                <th class="text-center">Billed</th>
              </tr>
            </thead>
            <tbody>
              ${project.timesheetEntries.map((entry: any) => `
                <tr>
                  <td>${new Date(entry.date).toLocaleDateString()}</td>
                  <td>${entry.user.name}</td>
                  <td class="text-right">${entry.hours.toFixed(2)}</td>
                  <td class="text-right">${entry.rate ? `${currencySymbol}${entry.rate.toFixed(2)}` : '-'}</td>
                  <td class="text-right">${currencySymbol}${(entry.hours * (entry.rate || 0)).toFixed(2)}</td>
                  <td class="text-center">${entry.billable ? 'Yes' : 'No'}</td>
                  <td class="text-center">${entry.billed ? 'Yes' : 'No'}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="font-weight: bold;">
                <td colspan="2">Total</td>
                <td class="text-right">${totalHours.toFixed(2)}</td>
                <td colspan="2" class="text-right">${currencySymbol}${totalTimesheetAmount.toFixed(2)}</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        ` : ''}

        ${project.charges && project.charges.length > 0 ? `
        <div class="section">
          <h2>Project Charges (${project.charges.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th class="text-right">Quantity</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Amount</th>
                <th class="text-center">Billed</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              ${project.charges.map((charge: any) => `
                <tr>
                  <td>${charge.description}</td>
                  <td class="text-right">${charge.quantity || 1}</td>
                  <td class="text-right">${charge.unitPrice ? `${currencySymbol}${charge.unitPrice.toFixed(2)}` : '-'}</td>
                  <td class="text-right">${currencySymbol}${charge.amount.toFixed(2)}</td>
                  <td class="text-center">${charge.billed ? 'Yes' : 'No'}</td>
                  <td>${charge.chargeType}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="font-weight: bold;">
                <td colspan="3">Total</td>
                <td class="text-right">${currencySymbol}${totalCharges.toFixed(2)}</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        ` : ''}

        ${project.bills && project.bills.length > 0 ? `
        <div class="section">
          <h2>Invoices (${project.bills.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Invoice Number</th>
                <th>Date</th>
                <th class="text-right">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${project.bills.map((bill: any) => `
                <tr>
                  <td>${bill.invoiceNumber || bill.id}</td>
                  <td>${new Date(bill.createdAt).toLocaleDateString()}</td>
                  <td class="text-right">${currencySymbol}${bill.amount.toFixed(2)}</td>
                  <td>${bill.status}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="font-weight: bold;">
                <td colspan="2">Total</td>
                <td class="text-right">${currencySymbol}${totalBilled.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        ` : ''}
      </body>
    </html>
  `
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role === "CLIENT") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
          },
        },
        proposal: {
          select: {
            id: true,
            title: true,
            amount: true,
            currency: true,
          },
        },
        bills: {
          include: {
            creator: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        timesheetEntries: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { date: "desc" },
        },
        charges: {
          orderBy: { createdAt: "desc" },
        },
        projectManagers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    if (!project.client.email) {
      return NextResponse.json(
        { error: "Client email is not set. Please update the client information first." },
        { status: 400 }
      )
    }

    // Generate PDF
    const logoBase64 = await getLogoBase64()
    const html = generateProjectReportHTML(project, logoBase64)
    const pdfBuffer = await generatePdfFromHTML(html)

    // Send email
    const result = await sendProjectReportEmail(
      project.client.email,
      project.client.name,
      {
        id: project.id,
        name: project.name,
        description: project.description,
      },
      pdfBuffer
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send email" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Project report email sent successfully",
    })
  } catch (error: any) {
    console.error("Error sending project report email:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}


