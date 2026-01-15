export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

async function getCurrencySymbol(currency: string) {
  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    CAD: "C$",
    AUD: "A$",
  }
  return symbols[currency] || currency
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            name: true,
            company: true,
            email: true,
          },
        },
        lead: {
          select: {
            name: true,
            company: true,
            email: true,
          },
        },
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
        items: {
          orderBy: { createdAt: "asc" },
        },
        milestones: {
          orderBy: { dueDate: "asc" },
        },
        tags: true,
        paymentTerms: {
          where: {
            proposalItemId: null, // Only get proposal-level payment terms
          },
          orderBy: { createdAt: "asc" },
        },
      },
    })

    if (!proposal) {
      return new NextResponse("Proposal not found", { status: 404 })
    }

    // If token is provided, verify it matches (for public access)
    if (token && proposal.clientApprovalToken !== token) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const currencySymbol = await getCurrencySymbol(proposal.currency)
    const recipient = proposal.client || proposal.lead

    // Generate HTML for PDF
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 40px;
              color: #333;
            }
            .header {
              margin-bottom: 30px;
              border-bottom: 2px solid #2563eb;
              padding-bottom: 20px;
            }
            .title {
              font-size: 24px;
              font-weight: bold;
              color: #111827;
              margin-bottom: 10px;
            }
            .proposal-number {
              color: #6b7280;
              font-size: 14px;
            }
            .details {
              margin: 30px 0;
            }
            .detail-row {
              display: flex;
              margin-bottom: 10px;
            }
            .detail-label {
              font-weight: bold;
              width: 150px;
              color: #374151;
            }
            .detail-value {
              color: #111827;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 30px 0;
            }
            .items-table th {
              background-color: #f3f4f6;
              padding: 12px;
              text-align: left;
              font-weight: bold;
              color: #374151;
              border-bottom: 2px solid #e5e7eb;
            }
            .items-table td {
              padding: 12px;
              border-bottom: 1px solid #e5e7eb;
            }
            .items-table tfoot td {
              font-weight: bold;
              background-color: #f9fafb;
              border-top: 2px solid #e5e7eb;
            }
            .total {
              text-align: right;
              font-size: 18px;
              margin-top: 20px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              font-size: 12px;
              color: #6b7280;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${proposal.title}</div>
            ${proposal.proposalNumber ? `<div class="proposal-number">Proposal #${proposal.proposalNumber}</div>` : ""}
          </div>

          <div class="details">
            ${recipient ? `
              <div class="detail-row">
                <div class="detail-label">${proposal.client ? "Client" : "Lead"}:</div>
                <div class="detail-value">${recipient.name}${recipient.company ? ` (${recipient.company})` : ""}</div>
              </div>
            ` : ""}
            <div class="detail-row">
              <div class="detail-label">Created by:</div>
              <div class="detail-value">${proposal.creator.name}</div>
            </div>
            ${proposal.issueDate ? `
              <div class="detail-row">
                <div class="detail-label">Issue Date:</div>
                <div class="detail-value">${new Date(proposal.issueDate).toLocaleDateString()}</div>
              </div>
            ` : ""}
            ${proposal.expiryDate ? `
              <div class="detail-row">
                <div class="detail-label">Expiry Date:</div>
                <div class="detail-value">${new Date(proposal.expiryDate).toLocaleDateString()}</div>
              </div>
            ` : ""}
          </div>

          ${proposal.description ? `
            <div style="margin: 30px 0;">
              <h3 style="color: #374151; margin-bottom: 10px;">Description</h3>
              <p style="color: #111827; white-space: pre-wrap;">${proposal.description}</p>
            </div>
          ` : ""}

          ${proposal.items.some((item: any) => item.isEstimate === true) ? `
            <div style="margin: 30px 0; padding: 15px; background-color: #fef3c7; border: 2px solid #fbbf24; border-radius: 8px;">
              <p style="color: #92400e; font-weight: bold; font-size: 16px; margin: 0;">
                ⚠️ Proposed fees are estimated
              </p>
            </div>
          ` : ""}

          ${proposal.items.length > 0 ? `
            <table class="items-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th style="text-align: right;">Quantity</th>
                  <th style="text-align: right;">Unit Price</th>
                  <th style="text-align: right;">Discount</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${proposal.items.map(item => {
                  const isHourly = item.billingMethod === "HOURLY" || (item.quantity && item.rate)
                  const estimateInfo = item.isEstimate && isHourly 
                    ? `<div style="font-size: 11px; color: #92400e; background-color: #fef3c7; padding: 4px 8px; border-radius: 4px; margin-top: 4px; display: inline-block;">
                        Estimated: ${item.quantity || 0} hours at ${currencySymbol}${item.rate?.toFixed(2) || "0.00"}/hr = ${currencySymbol}${item.amount.toFixed(2)}
                      </div>`
                    : ""
                  const cappedInfo = item.isCapped && isHourly
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
                    <td style="text-align: right;">${item.quantity || "-"}</td>
                    <td style="text-align: right;">${unitPriceDisplay}</td>
                    <td style="text-align: right;">${discountDisplay}</td>
                    <td style="text-align: right;">${currencySymbol}${item.amount.toFixed(2)}</td>
                  </tr>
                `
                }).join("")}
              </tbody>
              <tfoot>
                ${(() => {
                  const subtotal = proposal.amount || proposal.items.reduce((sum: number, item: any) => sum + item.amount, 0)
                  const hasEstimated = proposal.items.some((item: any) => item.isEstimate === true)
                  const hasCapped = proposal.items.some((item: any) => item.isCapped === true)
                  let cappedAmount = 0
                  if (hasCapped) {
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
                  
                  return `
                    <tr>
                      <td colspan="4" style="text-align: right; font-weight: bold;">
                        ${hasEstimated ? "Subtotal (Estimated):" : "Subtotal:"}
                      </td>
                      <td style="text-align: right; font-size: 18px;">
                        ${currencySymbol}${subtotal.toFixed(2)}
                      </td>
                    </tr>
                    ${hasCapped && cappedAmount > 0 ? `
                      <tr>
                        <td colspan="4" style="text-align: right; font-weight: bold; color: #1e40af; padding-top: 10px; border-top: 1px solid #dbeafe;">
                          Maximum Price (Capped):
                        </td>
                        <td style="text-align: right; font-size: 18px; color: #1e40af; padding-top: 10px; border-top: 1px solid #dbeafe;">
                          ${currencySymbol}${cappedAmount.toFixed(2)}
                        </td>
                      </tr>
                    ` : ""}
                  `
                })()}
              </tfoot>
            </table>
          ` : proposal.amount ? `
            <div class="total">
              <strong>Total: ${currencySymbol}${proposal.amount.toFixed(2)}</strong>
            </div>
          ` : ""}

          ${proposal.paymentTerms && proposal.paymentTerms.length > 0 ? (() => {
            const paymentTerm = proposal.paymentTerms[0]
            const { upfrontType, upfrontValue, balancePaymentType, balanceDueDate, installmentType, installmentCount, installmentFrequency, recurringEnabled, recurringFrequency, recurringCustomMonths, recurringStartDate } = paymentTerm
            
            let paymentTermsHtml = '<div style="margin: 30px 0; padding: 20px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">'
            paymentTermsHtml += '<h3 style="color: #374151; margin-bottom: 15px; font-size: 16px;">Payment Terms</h3>'
            
            // Upfront Payment
            if (upfrontType && upfrontValue !== null && upfrontValue !== undefined) {
              paymentTermsHtml += `<p style="margin: 8px 0; color: #111827;"><strong>Upfront Payment:</strong> ${upfrontType === "PERCENT" ? `${upfrontValue}%` : `${currencySymbol}${upfrontValue.toFixed(2)}`}</p>`
            } else {
              paymentTermsHtml += `<p style="margin: 8px 0; color: #111827;"><strong>Upfront Payment:</strong> No upfront payment</p>`
            }
            
            // Balance Payment (if upfront exists)
            if (upfrontType && upfrontValue !== null && upfrontValue !== undefined && balancePaymentType) {
              if (balancePaymentType === "TIME_BASED" && balanceDueDate) {
                paymentTermsHtml += `<p style="margin: 8px 0; color: #111827;"><strong>Balance Payment:</strong> Due on ${new Date(balanceDueDate).toLocaleDateString()}</p>`
              } else if (balancePaymentType === "MILESTONE_BASED") {
                paymentTermsHtml += `<p style="margin: 8px 0; color: #111827;"><strong>Balance Payment:</strong> Milestone-based</p>`
              } else if (balancePaymentType === "FULL_UPFRONT") {
                paymentTermsHtml += `<p style="margin: 8px 0; color: #111827;"><strong>Balance Payment:</strong> Full upfront (100%)</p>`
              }
            }
            
            // Installments (if no upfront)
            if ((!upfrontType || upfrontValue === null || upfrontValue === undefined) && installmentType && installmentCount) {
              paymentTermsHtml += `<p style="margin: 8px 0; color: #111827;"><strong>Payment Schedule:</strong> ${installmentCount} payment${installmentCount > 1 ? 's' : ''}${installmentFrequency ? ` (${installmentFrequency.toLowerCase()})` : ''}${installmentType === "MILESTONE_BASED" ? " - Based on milestones" : " - Time-based"}</p>`
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
              paymentTermsHtml += `<p style="margin: 8px 0; color: #111827;"><strong>Recurring Payment:</strong> ${recurringText}</p>`
            }
            
            // Default: One-time payment if nothing else is set
            if (!upfrontType && !installmentType && (recurringEnabled === false || recurringEnabled === null || recurringEnabled === undefined)) {
              if (balanceDueDate) {
                paymentTermsHtml += `<p style="margin: 8px 0; color: #111827;"><strong>Payment Terms:</strong> Due on ${new Date(balanceDueDate).toLocaleDateString()}</p>`
              } else {
                paymentTermsHtml += `<p style="margin: 8px 0; color: #111827;"><strong>Payment Terms:</strong> Paid on completion</p>`
              }
            }
            
            paymentTermsHtml += '</div>'
            return paymentTermsHtml
          })() : ""}

          <div class="footer">
            <p>Generated on ${new Date().toLocaleDateString()}</p>
          </div>
        </body>
      </html>
    `

    // Generate PDF using puppeteer
    try {
      // Configure Puppeteer for Vercel/serverless
      const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
      
      // Use puppeteer-core in serverless, puppeteer locally
      const puppeteer = isVercel 
        ? await import("puppeteer-core")
        : await import("puppeteer")
      
      const launchOptions: any = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
        ],
      }

      // Use @sparticuz/chromium on Vercel
      if (isVercel) {
        try {
          const chromium = require("@sparticuz/chromium")
          // Set font path to /tmp (available in Vercel serverless)
          if (typeof chromium.setFontPath === 'function') {
            chromium.setFontPath('/tmp')
          }
          // Get executable path - this may extract chromium binary
          const executablePath = await chromium.executablePath()
          if (executablePath) {
            launchOptions.executablePath = executablePath
            launchOptions.args = chromium.args || []
            launchOptions.defaultViewport = chromium.defaultViewport
            launchOptions.headless = chromium.headless !== false
          } else {
            throw new Error("Could not get chromium executable path")
          }
        } catch (chromiumError: any) {
          console.error("Could not load @sparticuz/chromium:", chromiumError)
          // In serverless, if chromium fails, we can't generate PDF
          throw new Error("PDF generation not available in serverless environment without chromium")
        }
      }

      const browser = await puppeteer.launch(launchOptions)
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
      })
      await browser.close()

      return new NextResponse(Buffer.from(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="proposal-${proposal.proposalNumber || proposal.id}.pdf"`,
          'Cache-Control': 'public, max-age=3600',
        },
      })
    } catch (pdfError: any) {
      console.error("PDF generation error:", pdfError)
      return new NextResponse(
        `Failed to generate PDF: ${pdfError.message}`,
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("Error generating proposal PDF:", error)
    return new NextResponse(
      `Internal server error: ${error.message}`,
      { status: 500 }
    )
  }
}
