export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendInvoiceEmail } from "@/lib/email"
import { generateInvoicePdf, getLogoBase64 } from "@/lib/pdfkit-generator"

// Reuse the HTML generation from the PDF route
function generateInvoiceHTML(bill: any, logoBase64: string | null): string {
  const currency = bill.project?.currency || "EUR"
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
          .description-box {
            background-color: #f0f9ff;
            border-left: 4px solid #3b82f6;
            padding: 15px;
            margin-top: 20px;
            margin-bottom: 30px;
            border-radius: 4px;
          }
          .description-box p {
            margin: 0;
            color: #1e40af;
          }
          .payment-details-section {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
          .payment-details-section h2 {
            color: #111827;
            margin-bottom: 15px;
          }
          .payment-details-section pre {
            background-color: #f9fafb;
            padding: 15px;
            border-radius: 6px;
            white-space: pre-wrap;
            word-break: break-word;
            font-family: monospace;
            font-size: 0.9em;
            color: #374151;
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
          <h1>INVOICE</h1>
          ${bill.invoiceNumber ? `<p><strong>Invoice Number:</strong> ${bill.invoiceNumber}</p>` : ''}
          ${bill.status ? `<span class="status-badge status-${bill.status}">${bill.status}</span>` : ''}
          ${bill.description ? `
            <div class="description-box">
              <p>${bill.description}</p>
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
          </div>
        </div>

        <div class="section">
          <h2>Bill To</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">${bill.client ? "Client Name" : "Lead Name"}</div>
              <div class="info-value">${bill.client?.name || bill.lead?.name || ""}</div>
            </div>
            ${(bill.client?.company || bill.lead?.company) ? `
            <div class="info-item">
              <div class="info-label">Company</div>
              <div class="info-value">${bill.client?.company || bill.lead?.company || ""}</div>
            </div>
            ` : ''}
            ${(bill.client?.email || bill.lead?.email) ? `
            <div class="info-item">
              <div class="info-label">Email</div>
              <div class="info-value">${bill.client?.email || bill.lead?.email || ""}</div>
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
                <th>Person</th>
                <th>Quantity</th>
                <th>Rate/Price</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${bill.items.map((item: any) => `
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

        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>${currencySymbol}${subtotal.toFixed(2)}</span>
          </div>
          ${discount > 0 ? `
          <div class="total-row">
            <span>Discount:</span>
            <span>-${currencySymbol}${discount.toFixed(2)}</span>
          </div>
          ` : ''}
          ${taxAmount > 0 ? `
          <div class="total-row">
            <span>Tax (${bill.taxRate}%):</span>
            <span>${currencySymbol}${taxAmount.toFixed(2)}</span>
          </div>
          ` : ''}
          <div class="total-row total-final">
            <span>Total:</span>
            <span>${currencySymbol}${total.toFixed(2)}</span>
          </div>
        </div>

        ${bill.paymentDetails ? `
        <div class="payment-details-section">
          <h2>Payment Details</h2>
          <pre>${bill.paymentDetails.details}</pre>
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

    const bill = await prisma.bill.findUnique({
      where: { id },
      include: {
        client: true,
        lead: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
          },
        },
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
            currency: true,
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

    // Determine recipient email and name (from client or lead)
    const recipientEmail = bill.client?.email || bill.lead?.email
    const recipientName = bill.client?.name || bill.lead?.name || bill.client?.company || bill.lead?.company || ""

    if (!recipientEmail) {
      const entityType = bill.client ? "client" : "lead"
      return NextResponse.json(
        { error: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} email is not set. Please update the ${entityType} information first.` },
        { status: 400 }
      )
    }

    // Generate HTML invoice (for email body fallback)
    const logoBase64 = await getLogoBase64()
    const html = generateInvoiceHTML(bill, logoBase64)
    
    // Try to generate PDF, but fallback to HTML if it fails
    let pdfBuffer: Buffer | undefined
    try {
      pdfBuffer = await generateInvoicePdf(bill, logoBase64)
    } catch (pdfError: any) {
      console.warn("PDF generation failed, sending invoice as HTML email:", pdfError.message)
      // Continue without PDF - we'll send HTML invoice in email body
    }

    // Send email with PDF if available, otherwise with HTML invoice embedded
    const result = await sendInvoiceEmail(
      recipientEmail,
      recipientName,
      {
        id: bill.id,
        invoiceNumber: bill.invoiceNumber,
        amount: bill.amount,
        description: bill.description,
        dueDate: bill.dueDate,
        currency: bill.project?.currency || bill.proposal?.currency || "EUR",
      },
      pdfBuffer,
      pdfBuffer ? undefined : html // If no PDF, embed HTML invoice in email
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send email" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Invoice email sent successfully",
    })
  } catch (error: any) {
    console.error("Error sending invoice email:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}



