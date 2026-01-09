export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendClientApprovalRequest, sendEmail } from "@/lib/email"
import { getDefaultTemplate, renderTemplate } from "@/lib/email-templates"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    const body = await request.json().catch(() => ({})) // Optional body with custom subject/body
    const customSubject = body.subject
    const customBody = body.body
    
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
        lead: true,
        creator: true,
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            description: true,
            quantity: true,
            rate: true,
            amount: true,
          },
        },
      },
    })

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    // Check if internal approvals are complete
    if (proposal.internalApprovalRequired && !proposal.internalApprovalsComplete) {
      return NextResponse.json(
        { error: "Cannot send approval email until all internal approvals are complete" },
        { status: 400 }
      )
    }

    // Determine recipient: client or lead
    let recipientEmail: string | null = null
    let recipientName: string = ""
    let isLead = false

    if (proposal.client && proposal.client.email) {
      recipientEmail = proposal.client.email
      recipientName = proposal.client.name
      isLead = false
    } else if (proposal.lead && proposal.lead.email) {
      recipientEmail = proposal.lead.email
      recipientName = proposal.lead.name
      isLead = true
    }

    if (!recipientEmail) {
      return NextResponse.json(
        { error: "Neither client nor lead email is set. Please update the client or lead information first." },
        { status: 400 }
      )
    }

    // Generate or reuse approval token
    let approvalToken = proposal.clientApprovalToken?.trim() || null
    if (!approvalToken || (proposal.clientApprovalTokenExpiry && new Date() > proposal.clientApprovalTokenExpiry)) {
      const cryptoModule = await import("crypto")
      approvalToken = cryptoModule.randomBytes(32).toString("hex")
      console.log("Generated new approval token:", {
        token: approvalToken,
        length: approvalToken.length,
      })
    } else {
      console.log("Reusing existing approval token:", {
        token: approvalToken,
        length: approvalToken.length,
      })
    }

    const tokenExpiry = new Date()
    tokenExpiry.setDate(tokenExpiry.getDate() + 30) // 30 days expiry

    // Save token to database BEFORE sending email to ensure it's available
    // Ensure token is trimmed before saving
    const tokenToSave = approvalToken.trim()
    console.log("Saving approval token:", {
      proposalId: id,
      originalToken: approvalToken,
      tokenToSave: tokenToSave,
      tokenLength: tokenToSave.length,
      expiry: tokenExpiry,
    })
    
    await prisma.proposal.update({
      where: { id },
      data: {
        clientApprovalToken: tokenToSave,
        clientApprovalTokenExpiry: tokenExpiry,
        clientApprovalStatus: "PENDING",
      },
    })
    
    console.log("Token saved successfully to database:", {
      savedToken: tokenToSave,
      tokenLength: tokenToSave.length,
    })
    
    // Update approvalToken variable to use trimmed version for consistency
    approvalToken = tokenToSave

    // Generate PDF for attachment
    let pdfBuffer: Buffer | null = null
    let pdfGenerationFailed = false
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
          // If chromium fails, we can't generate PDF in serverless
          // The outer try-catch will handle this and continue without PDF
          // Note: PDF can still be downloaded from the review page
          throw new Error("PDF generation not available in serverless environment without chromium")
        }
      }

      const browser = await puppeteer.launch(launchOptions)
      
      const currencySymbols: Record<string, string> = {
        USD: "$",
        EUR: "€",
        GBP: "£",
        CAD: "C$",
        AUD: "A$",
      }
      const currencySymbol = currencySymbols[proposal.currency] || proposal.currency
      const recipient = proposal.client || proposal.lead
      
      // Generate PDF HTML
      const pdfHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
              .header { margin-bottom: 30px; border-bottom: 2px solid #2563eb; padding-bottom: 20px; }
              .title { font-size: 24px; font-weight: bold; color: #111827; margin-bottom: 10px; }
              .proposal-number { color: #6b7280; font-size: 14px; }
              .details { margin: 30px 0; }
              .detail-row { display: flex; margin-bottom: 10px; }
              .detail-label { font-weight: bold; width: 150px; color: #374151; }
              .detail-value { color: #111827; }
              .items-table { width: 100%; border-collapse: collapse; margin: 30px 0; }
              .items-table th { background-color: #f3f4f6; padding: 12px; text-align: left; font-weight: bold; color: #374151; border-bottom: 2px solid #e5e7eb; }
              .items-table td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
              .items-table tfoot td { font-weight: bold; background-color: #f9fafb; border-top: 2px solid #e5e7eb; }
              .total { text-align: right; font-size: 18px; margin-top: 20px; }
              .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">${proposal.title}</div>
              ${proposal.proposalNumber ? `<div class="proposal-number">Proposal #${proposal.proposalNumber}</div>` : ""}
            </div>
            <div class="details">
              ${recipient ? `<div class="detail-row"><div class="detail-label">${proposal.client ? "Client" : "Lead"}:</div><div class="detail-value">${recipient.name}${recipient.company ? ` (${recipient.company})` : ""}</div></div>` : ""}
              <div class="detail-row"><div class="detail-label">Created by:</div><div class="detail-value">${proposal.creator.name}</div></div>
              ${proposal.issueDate ? `<div class="detail-row"><div class="detail-label">Issue Date:</div><div class="detail-value">${new Date(proposal.issueDate).toLocaleDateString()}</div></div>` : ""}
              ${proposal.expiryDate ? `<div class="detail-row"><div class="detail-label">Expiry Date:</div><div class="detail-value">${new Date(proposal.expiryDate).toLocaleDateString()}</div></div>` : ""}
            </div>
            ${proposal.description ? `<div style="margin: 30px 0;"><h3 style="color: #374151; margin-bottom: 10px;">Description</h3><p style="color: #111827; white-space: pre-wrap;">${(proposal.description || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p></div>` : ""}
            ${proposal.items && proposal.items.length > 0 ? `
              <table class="items-table">
                <thead><tr><th>Description</th>${proposal.items.some((i: any) => i.quantity) ? "<th style=\"text-align: right;\">Qty</th>" : ""}${proposal.items.some((i: any) => i.rate) ? "<th style=\"text-align: right;\">Rate</th>" : ""}<th style=\"text-align: right;\">Amount</th></tr></thead>
                <tbody>${proposal.items.map((item: any) => `<tr><td>${(item.description || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>${proposal.items.some((i: any) => i.quantity) ? `<td style="text-align: right;">${item.quantity || "-"}</td>` : ""}${proposal.items.some((i: any) => i.rate) ? `<td style="text-align: right;">${item.rate ? `${currencySymbol}${item.rate.toFixed(2)}` : "-"}</td>` : ""}<td style="text-align: right;">${currencySymbol}${item.amount.toFixed(2)}</td></tr>`).join("")}</tbody>
                ${proposal.amount ? `<tfoot><tr><td colspan="${proposal.items.some((i: any) => i.quantity) && proposal.items.some((i: any) => i.rate) ? 3 : proposal.items.some((i: any) => i.quantity) || proposal.items.some((i: any) => i.rate) ? 2 : 1}" style="text-align: right; font-weight: bold;">Total:</td><td style="text-align: right; font-size: 18px;">${currencySymbol}${proposal.amount.toFixed(2)}</td></tr></tfoot>` : ""}
              </table>
            ` : proposal.amount ? `<div class="total"><strong>Total: ${currencySymbol}${proposal.amount.toFixed(2)}</strong></div>` : ""}
            <div class="footer"><p>Generated on ${new Date().toLocaleDateString()}</p></div>
          </body>
        </html>
      `
      
      const page = await browser.newPage()
      await page.setContent(pdfHTML, { waitUntil: 'networkidle0' })
      const pdfData = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
      })
      pdfBuffer = Buffer.from(pdfData)
      await browser.close()
      console.log("PDF generated successfully:", {
        bufferSize: pdfBuffer.length,
        filename: `proposal-${proposal.proposalNumber || proposal.id}.pdf`,
      })
    } catch (pdfError: any) {
      console.error("Failed to generate PDF for attachment:", pdfError)
      console.error("PDF Error details:", {
        message: pdfError.message,
        stack: pdfError.stack,
        name: pdfError.name,
      })
      // Continue without PDF - email will still be sent
      pdfGenerationFailed = true
    }

    // Load email template or use default
    let emailSubject: string
    let emailBody: string

    if (customSubject && customBody) {
      // Use custom subject and body from quick edit
      emailSubject = customSubject
      emailBody = customBody
    } else {
      // Load template from database or use default
      let template = await prisma.emailTemplate.findFirst({
        where: {
          type: "PROPOSAL",
          isDefault: true,
        },
      })

      // If no default template, get the default one
      let finalTemplate: { subject: string; body: string }
      if (!template) {
        const defaultTemplate = await getDefaultTemplate("PROPOSAL")
        if (defaultTemplate && typeof defaultTemplate === 'object' && 'subject' in defaultTemplate) {
          finalTemplate = {
            subject: defaultTemplate.subject || `Proposal Approval Request: ${proposal.title}`,
            body: defaultTemplate.body || "",
          }
        } else {
          finalTemplate = {
            subject: `Proposal Approval Request: ${proposal.title}`,
            body: "",
          }
        }
      } else {
        finalTemplate = {
          subject: template.subject,
          body: template.body,
        }
      }

      // Get base URL from environment or request headers
      const getBaseUrl = () => {
        // Try environment variables first
        if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL
        if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
        // Try to get from Vercel environment
        if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
        // Fallback to localhost for development
        return 'http://localhost:3000'
      }
      const baseUrl = getBaseUrl()
      // Trim token and URL encode it to ensure it's properly formatted in the URL
      const trimmedToken = approvalToken.trim()
      const reviewUrl = `${baseUrl}/proposals/${proposal.id}/review?token=${encodeURIComponent(trimmedToken)}`
      
      console.log("Generated review URL:", {
        baseUrl,
        proposalId: proposal.id,
        originalToken: approvalToken,
        trimmedToken: trimmedToken,
        encodedToken: encodeURIComponent(trimmedToken),
        reviewUrl,
        tokenLength: trimmedToken.length,
      })

      const variables = {
        proposal: {
          title: proposal.title,
          number: proposal.proposalNumber,
          description: proposal.description || undefined,
          amount: proposal.amount || undefined,
          currency: proposal.currency,
          issueDate: proposal.issueDate || undefined,
          expiryDate: proposal.expiryDate || undefined,
        },
        client: proposal.client ? {
          name: proposal.client.name,
          company: proposal.client.company || undefined,
          email: proposal.client.email || undefined,
        } : undefined,
        lead: proposal.lead ? {
          name: proposal.lead.name,
          company: proposal.lead.company || undefined,
          email: proposal.lead.email || undefined,
        } : undefined,
        reviewLink: reviewUrl,
      }

      emailSubject = renderTemplate(finalTemplate.subject || `Proposal Approval Request: ${proposal.title}`, variables)
      emailBody = renderTemplate(finalTemplate.body || "", variables)
      
      console.log("Email body after template rendering:", {
        hasReviewUrl: emailBody.includes(reviewUrl),
        hasReviewLinkPlaceholder: emailBody.includes('{{reviewLink}}'),
        reviewUrlInBody: emailBody.includes(reviewUrl),
        emailBodyLength: emailBody.length,
        reviewUrl: reviewUrl,
      })
      
      // Always ensure the review link is in the email, even if template replacement failed
      // Replace {{reviewLink}} if it exists but wasn't replaced
      emailBody = emailBody.replace(/\{\{reviewLink\}\}/g, reviewUrl)
      
      // If reviewUrl is still not in the body, add it as a button
      if (!emailBody.includes(reviewUrl)) {
        console.log("Review URL not found in email body, adding approval button")
        const approvalButton = `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${reviewUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Review & Approve Proposal
            </a>
          </div>
        `
        emailBody += approvalButton
      } else {
        // Ensure any review link is styled as a button AND has the correct URL with token
        emailBody = emailBody.replace(
          /<a\s+href=["']([^"']*review[^"']*)["'][^>]*>([^<]*)<\/a>/gi,
          (match, url, text) => {
            if (url.includes('review')) {
              // Always use the full reviewUrl with token, not the matched URL
              const linkUrl = url.includes('token=') ? url : reviewUrl
              const hasStyle = match.includes('style=')
              const buttonStyle = "background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; margin: 20px 0;"
              
              if (hasStyle) {
                // Replace the href but keep existing styles
                return match.replace(/href=["'][^"']*["']/, `href="${linkUrl}"`)
              } else {
                return `<a href="${linkUrl}" style="${buttonStyle}">${text}</a>`
              }
            }
            return match
          }
        )
      }
      
      // Final check - ensure all review links have the token parameter
      // Check if any review link is missing the token parameter
      const reviewLinkPattern = /<a\s+href=["']([^"']*\/review[^"']*)["'][^>]*>/gi
      const reviewLinks = emailBody.match(reviewLinkPattern)
      
      if (reviewLinks) {
        reviewLinks.forEach(link => {
          // Check if this link has the token parameter
          if (!link.includes('token=')) {
            console.warn("Found review link without token, replacing with full URL")
            // Replace the href with the full reviewUrl
            emailBody = emailBody.replace(
              /(<a\s+href=["'])([^"']*\/review)([^"']*)(["'][^>]*>)/gi,
              (match, prefix, reviewPath, rest, suffix) => {
                if (!match.includes('token=')) {
                  return `${prefix}${reviewUrl}${suffix}`
                }
                return match
              }
            )
          }
        })
      }
      
      if (!emailBody.includes(reviewUrl)) {
        console.error("CRITICAL: Review URL not found in email body after all processing!")
        // Force add it at the end
        emailBody += `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${reviewUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Review & Approve Proposal
            </a>
          </div>
        `
      }
      
      console.log("Final email body check:", {
        hasReviewUrl: emailBody.includes(reviewUrl),
        reviewUrlPosition: emailBody.indexOf(reviewUrl),
        reviewUrlWithToken: emailBody.includes('token='),
        sampleLink: emailBody.match(/<a\s+href=["'][^"']*review[^"']*["']/)?.[0],
      })
      
      // Add note about PDF download if PDF generation failed
      if (pdfGenerationFailed && !emailBody.includes('download the PDF') && !emailBody.includes('Download PDF')) {
        const pdfNote = `
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
            <strong>Note:</strong> You can download a PDF copy of this proposal from the review page using the download button.
          </p>
        `
        emailBody += pdfNote
      }
    }

    // Send email with PDF attachment
    try {
      const attachments = pdfBuffer ? [{
        filename: `proposal-${proposal.proposalNumber || proposal.id}.pdf`,
        content: pdfBuffer,
      }] : undefined
      
      console.log("Sending email with attachments:", {
        hasPdfBuffer: !!pdfBuffer,
        pdfBufferSize: pdfBuffer?.length || 0,
        attachmentsCount: attachments?.length || 0,
        recipientEmail,
      })
      
      const emailResult = await sendEmail({
        to: recipientEmail,
        subject: emailSubject,
        html: emailBody,
        attachments,
      })

      // Check if email was actually sent
      if (!emailResult.success) {
        console.error("Failed to send approval email:", emailResult.error)
        return NextResponse.json(
          { error: "Failed to send email", message: emailResult.error || "Unknown error" },
          { status: 500 }
        )
      }

      console.log("Email sent successfully:", emailResult.data)
    } catch (emailError: any) {
      console.error("Failed to send approval email:", emailError)
      return NextResponse.json(
        { error: "Failed to send email", message: emailError.message },
        { status: 500 }
      )
    }

    // Update proposal - track who sent the email (token already saved above before sending email)
    const updatedProposal = await prisma.proposal.update({
      where: { id },
      data: {
        clientApprovalEmailSent: true,
        clientApprovalEmailSentBy: session.user.id, // Track who sent the email
        // Token and expiry already saved above before sending email
      },
    })

    return NextResponse.json({
      success: true,
      message: isLead ? "Lead approval email sent successfully" : "Client approval email sent successfully",
      proposal: updatedProposal,
    })
  } catch (error: any) {
    console.error("Error sending client approval email:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}

