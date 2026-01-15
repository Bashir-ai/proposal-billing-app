export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendProposalEmail } from "@/lib/email"
import { generatePdfFromHTML, getLogoBase64 } from "@/lib/pdf-generator"

// Reuse the HTML generation from the PDF route
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

        ${proposal.items && proposal.items.some((item: any) => item.isEstimate === true || item.isEstimated === true) ? `
        <div class="section">
          <div style="padding: 15px; background-color: #fef3c7; border: 2px solid #fbbf24; border-radius: 8px;">
            <p style="color: #92400e; font-weight: bold; font-size: 16px; margin: 0 0 10px 0;">
              ⚠️ Proposed fees are estimated
            </p>
            ${(() => {
              const hasCapped = proposal.items && proposal.items.some((item: any) => item.isCapped === true)
              let cappedAmount = 0
              if (hasCapped && proposal.items) {
                proposal.items.forEach((item: any) => {
                  if (item.isCapped) {
                    if (item.cappedHours && item.rate) {
                      cappedAmount += item.cappedHours * item.rate
                    } else if (item.cappedAmount) {
                      cappedAmount += item.cappedAmount
                    }
                  }
                })
              }
              return hasCapped && cappedAmount > 0 
                ? `<p style="color: #92400e; font-size: 14px; margin: 0;">
                    However, the total charge will not exceed ${currencySymbol}${cappedAmount.toFixed(2)}.
                  </p>`
                : ""
            })()}
          </div>
        </div>
        ` : ''}

        ${proposal.items && proposal.items.length > 0 ? `
        <div class="section">
          <h2>Line Items</h2>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Discount</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${proposal.items.map((item: any) => {
                const isHourly = item.billingMethod === "HOURLY" || (item.quantity && item.rate)
                const isExpense = !!item.expenseId
                const estimateInfo = (item.isEstimate || item.isEstimated)
                  ? `<div style="font-size: 11px; color: #92400e; background-color: #fef3c7; padding: 4px 8px; border-radius: 4px; margin-top: 4px; display: inline-block;">
                      ${item.isEstimated 
                        ? `Estimated expense: ${currencySymbol}${item.amount.toFixed(2)}`
                        : isHourly
                          ? `Estimated: ${item.quantity || 0} hours at ${currencySymbol}${item.rate?.toFixed(2) || "0.00"}/hr = ${currencySymbol}${item.amount.toFixed(2)}`
                          : `Estimated: ${currencySymbol}${item.amount.toFixed(2)}`}
                    </div>`
                  : ""
                const cappedInfo = item.isCapped
                  ? (item.cappedHours && item.rate
                      ? `<div style="font-size: 11px; color: #1e40af; background-color: #dbeafe; padding: 4px 8px; border-radius: 4px; margin-top: 4px; display: inline-block; margin-left: 8px;">
                          Capped at ${item.cappedHours} hours at ${currencySymbol}${item.rate.toFixed(2)}/hr = ${currencySymbol}${(item.cappedHours * item.rate).toFixed(2)}
                        </div>`
                      : item.cappedAmount
                        ? `<div style="font-size: 11px; color: #1e40af; background-color: #dbeafe; padding: 4px 8px; border-radius: 4px; margin-top: 4px; display: inline-block; margin-left: 8px;">
                            Capped at ${currencySymbol}${item.cappedAmount.toFixed(2)}
                          </div>`
                        : "")
                  : ""
                const unitPriceDisplay = item.rate 
                  ? `${currencySymbol}${item.rate.toFixed(2)}/hr` 
                  : item.unitPrice 
                    ? `${currencySymbol}${item.unitPrice.toFixed(2)}` 
                    : "-"
                const discountDisplay = item.discountPercent 
                  ? `${item.discountPercent}%` 
                  : item.discountAmount 
                    ? `${currencySymbol}${item.discountAmount.toFixed(2)}` 
                    : "-"
                return `
                <tr>
                  <td>
                    <div>${item.description || "-"}</div>
                    ${estimateInfo}
                    ${cappedInfo}
                  </td>
                  <td>${item.quantity || '-'}</td>
                  <td>${unitPriceDisplay}</td>
                  <td>${discountDisplay}</td>
                  <td class="text-right">${currencySymbol}${item.amount.toFixed(2)}</td>
                </tr>
              `
              }).join('')}
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

        ${proposal.amount || (proposal.items && proposal.items.length > 0) ? `
        <div class="section">
          <div class="total">
            <div class="text-right">
              ${(() => {
                const subtotal = proposal.amount || (proposal.items ? proposal.items.reduce((sum: number, item: any) => sum + item.amount, 0) : 0)
                const hasEstimated = proposal.items && proposal.items.some((item: any) => item.isEstimate === true || item.isEstimated === true)
                const hasCapped = proposal.items && proposal.items.some((item: any) => item.isCapped === true)
                let cappedAmount = 0
                if (hasCapped && proposal.items) {
                  proposal.items.forEach((item: any) => {
                    if (item.isCapped) {
                      if (item.cappedHours && item.rate) {
                        cappedAmount += item.cappedHours * item.rate
                      } else if (item.cappedAmount) {
                        cappedAmount += item.cappedAmount
                      }
                    }
                  })
                }
                
                // Calculate subtotal excluding expenses for tax calculation
                const subtotalExcludingExpenses = proposal.items 
                  ? proposal.items
                      .filter((item: any) => !item.expenseId)
                      .reduce((sum: number, item: any) => sum + item.amount, 0)
                  : 0
                
                let html = `<div>${hasEstimated ? "Subtotal (Estimated):" : "Subtotal:"} ${currencySymbol}${subtotal.toFixed(2)}</div>`
                if (proposal.taxRate) {
                  const taxAmount = subtotalExcludingExpenses * proposal.taxRate / 100
                  html += `<div>Tax (${proposal.taxRate}%): ${currencySymbol}${taxAmount.toFixed(2)}</div>`
                  html += `<div>Total with Tax: ${currencySymbol}${(subtotal + taxAmount).toFixed(2)}</div>`
                }
                if (hasCapped && cappedAmount > 0) {
                  html += `<div style="color: #1e40af; font-weight: bold; margin-top: 10px; padding-top: 10px; border-top: 1px solid #dbeafe;">Maximum Charge (Will Not Exceed): ${currencySymbol}${cappedAmount.toFixed(2)}</div>`
                }
                return html
              })()}
            </div>
          </div>
        </div>
        ` : ''}

        ${proposal.paymentTerms && proposal.paymentTerms.length > 0 ? (() => {
          // Get proposal-level payment term (where proposalItemId is null)
          const proposalPaymentTerm = proposal.paymentTerms.find((term: any) => !term.proposalItemId) || proposal.paymentTerms[0]
          if (!proposalPaymentTerm) return ''
          
          const { upfrontType, upfrontValue, balancePaymentType, balanceDueDate, installmentType, installmentCount, installmentFrequency, recurringEnabled, recurringFrequency, recurringCustomMonths, recurringStartDate } = proposalPaymentTerm
          
          let paymentTermsHtml = '<div class="section"><h2>Payment Terms</h2>'
          
          // Upfront Payment
          if (upfrontType && upfrontValue !== null && upfrontValue !== undefined) {
            paymentTermsHtml += `<p><strong>Upfront Payment:</strong> ${upfrontType === "PERCENT" ? `${upfrontValue}%` : `${currencySymbol}${upfrontValue.toFixed(2)}`}</p>`
          } else {
            paymentTermsHtml += `<p><strong>Upfront Payment:</strong> No upfront payment</p>`
          }
          
          // Balance Payment (if upfront exists)
          if (upfrontType && upfrontValue !== null && upfrontValue !== undefined && balancePaymentType) {
            if (balancePaymentType === "TIME_BASED" && balanceDueDate) {
              paymentTermsHtml += `<p><strong>Balance Payment:</strong> Due on ${new Date(balanceDueDate).toLocaleDateString()}</p>`
            } else if (balancePaymentType === "MILESTONE_BASED") {
              paymentTermsHtml += `<p><strong>Balance Payment:</strong> Milestone-based</p>`
            } else if (balancePaymentType === "FULL_UPFRONT") {
              paymentTermsHtml += `<p><strong>Balance Payment:</strong> Full upfront (100%)</p>`
            }
          }
          
          // Installments (if no upfront)
          if ((!upfrontType || upfrontValue === null || upfrontValue === undefined) && installmentType && installmentCount) {
            paymentTermsHtml += `<p><strong>Payment Schedule:</strong> ${installmentCount} payment${installmentCount > 1 ? 's' : ''}${installmentFrequency ? ` (${installmentFrequency.toLowerCase()})` : ''}${installmentType === "MILESTONE_BASED" ? " - Based on milestones" : " - Time-based"}</p>`
          }
          
          // Recurring Payment - only show if explicitly enabled
          if (recurringEnabled === true && recurringFrequency) {
            let recurringText = ""
            if (recurringFrequency === "MONTHLY_1") recurringText = "Monthly"
            else if (recurringFrequency === "MONTHLY_3") recurringText = "Every 3 months"
            else if (recurringFrequency === "MONTHLY_6") recurringText = "Every 6 months"
            else if (recurringFrequency === "YEARLY_12") recurringText = "Yearly"
            else if (recurringFrequency === "CUSTOM" && recurringCustomMonths) {
              recurringText = `Every ${recurringCustomMonths} month${recurringCustomMonths > 1 ? 's' : ''}`
            }
            if (recurringStartDate) {
              recurringText += ` - Starting ${new Date(recurringStartDate).toLocaleDateString()}`
            }
            paymentTermsHtml += `<p><strong>Recurring Payment:</strong> ${recurringText}</p>`
          }
          
          // Default: One-time payment if nothing else is set
          if (!upfrontType && !installmentType && (recurringEnabled === false || recurringEnabled === null || recurringEnabled === undefined)) {
            if (balanceDueDate) {
              paymentTermsHtml += `<p><strong>Payment Terms:</strong> Due on ${new Date(balanceDueDate).toLocaleDateString()}</p>`
            } else {
              paymentTermsHtml += `<p><strong>Payment Terms:</strong> Paid on completion</p>`
            }
          }
          
          paymentTermsHtml += '</div>'
          return paymentTermsHtml
        })() : ''}
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
        paymentTerms: {
          where: {
            proposalItemId: null, // Only get proposal-level payment terms
          },
          orderBy: { createdAt: "asc" },
        },
      },
    })

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    if (!proposal.client || !proposal.client.email) {
      return NextResponse.json(
        { error: "Client email is not set. Please update the client information first." },
        { status: 400 }
      )
    }

    // Generate PDF (optional - email can be sent without PDF)
    let pdfBuffer: Buffer | undefined = undefined
    let pdfGenerationFailed = false
    
    try {
      const logoBase64 = await getLogoBase64()
      const html = generateProposalHTML(proposal, logoBase64)
      pdfBuffer = await generatePdfFromHTML(html)
    } catch (pdfError: any) {
      console.error("Failed to generate PDF for attachment:", pdfError)
      pdfGenerationFailed = true
      // Continue without PDF - email can still be sent
    }

    // Send email (TypeScript now knows proposal.client is not null)
    const result = await sendProposalEmail(
      proposal.client.email,
      proposal.client.name,
      {
        id: proposal.id,
        title: proposal.title,
        proposalNumber: proposal.proposalNumber,
        description: proposal.description,
        amount: proposal.amount,
        currency: proposal.currency,
      },
      pdfBuffer // Will be undefined if PDF generation failed
    )

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error || "Failed to send email",
          pdfGenerationFailed: pdfGenerationFailed,
        },
        { status: 500 }
      )
    }

    // Update proposal to mark email as sent
    await prisma.proposal.update({
      where: { id },
      data: {
        clientApprovalEmailSent: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Proposal email sent successfully",
    })
  } catch (error: any) {
    console.error("Error sending proposal email:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}


