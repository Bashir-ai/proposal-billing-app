import { Resend } from "resend"

// Debug logging for environment variables
console.log("Email Config Debug:", {
  hasResendKey: !!process.env.RESEND_API_KEY,
  resendKeyPrefix: process.env.RESEND_API_KEY?.substring(0, 5) || "not set",
  resendKeyLength: process.env.RESEND_API_KEY?.length || 0,
  fromEmail: process.env.FROM_EMAIL || "not set",
  nodeEnv: process.env.NODE_ENV,
  vercel: !!process.env.VERCEL,
})

// Initialize Resend client
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@example.com"

// Get base URL from environment or Vercel
const getBaseUrl = () => {
  // Try environment variables first
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  // Try to get from Vercel environment
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  // Fallback to localhost for development
  return "http://localhost:3000"
}

const BASE_URL = getBaseUrl()

interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
  }>
}

export async function sendEmail({ to, subject, html, from = FROM_EMAIL, attachments }: SendEmailOptions) {
  if (!resend) {
    const errorMsg = "Resend API key not configured. Email not sent."
    console.error(errorMsg)
    console.log("Would send email:", { to, subject, from, attachments: attachments?.length || 0 })
    return { success: false, error: errorMsg }
  }

  try {
    const emailData: any = {
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }

    // Add attachments if provided
    // Resend expects attachments as base64 strings
    if (attachments && attachments.length > 0) {
      emailData.attachments = attachments.map(att => {
        let content: string
        if (Buffer.isBuffer(att.content)) {
          content = att.content.toString('base64')
        } else if (typeof att.content === 'string' && att.content.startsWith('data:')) {
          // Extract base64 from data URL
          content = att.content.split(',')[1]
        } else {
          // Assume it's already base64 string
          content = att.content
        }
        return {
          filename: att.filename,
          content: content,
        }
      })
    }

    console.log("Sending email via Resend:", { 
      to, 
      subject, 
      from, 
      hasAttachments: !!attachments?.length,
      resendConfigured: !!resend 
    })
    
    const result = await resend.emails.send(emailData)
    
    console.log("Resend API response:", JSON.stringify(result, null, 2))
    return { success: true, data: result }
  } catch (error: any) {
    console.error("Error sending email via Resend:", error)
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
      response: error.response?.data || error.response || "No response data",
    })
    return { success: false, error: error.message || "Unknown error occurred" }
  }
}

// Internal Approval Request Email
export async function sendInternalApprovalRequest(
  approverEmail: string,
  approverName: string,
  proposal: {
    id: string
    title: string
    proposalNumber: string | null
    client: { name: string; company: string | null }
    creator: { name: string }
    amount: number | null
    currency: string
  }
) {
  const proposalUrl = `${BASE_URL}/dashboard/proposals/${proposal.id}`
  const currencySymbol = getCurrencySymbol(proposal.currency)

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Approval Required</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="color: #2563eb; margin-top: 0;">Approval Required</h1>
          <p>Hello ${approverName},</p>
          <p>You have been requested to approve a proposal:</p>
        </div>

        <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #111827; margin-top: 0;">${proposal.title}</h2>
          <p><strong>Proposal Number:</strong> ${proposal.proposalNumber || "N/A"}</p>
          <p><strong>Client:</strong> ${proposal.client.name}${proposal.client.company ? ` (${proposal.client.company})` : ""}</p>
          <p><strong>Created by:</strong> ${proposal.creator.name}</p>
          ${proposal.amount ? `<p><strong>Amount:</strong> ${currencySymbol}${proposal.amount.toFixed(2)}</p>` : ""}
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${proposalUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Review Proposal
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          Please review the proposal and provide your approval or rejection through the dashboard.
        </p>
      </body>
    </html>
  `

  return sendEmail({
    to: approverEmail,
    subject: `Approval Required: ${proposal.title}`,
    html,
  })
}

// Client/Lead Approval Request Email
export async function sendClientApprovalRequest(
  clientEmail: string,
  clientName: string,
  proposal: {
    id: string
    title: string
    proposalNumber: string | null
    description: string | null
    amount: number | null
    currency: string
    issueDate: Date | null
    expiryDate: Date | null
    isLead?: boolean
  },
  approvalToken: string,
  attachments?: Array<{
    filename: string
    content: Buffer | string
  }>
) {
  const reviewUrl = `${BASE_URL}/proposals/${proposal.id}/review?token=${approvalToken}`
  const currencySymbol = getCurrencySymbol(proposal.currency)
  const recipientType = proposal.isLead ? "Lead" : "Client"

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Proposal Approval Request</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="color: #2563eb; margin-top: 0;">Proposal Approval Request</h1>
          <p>Hello ${clientName},</p>
          <p>We are pleased to present the following proposal for your review and approval:</p>
        </div>

        <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #111827; margin-top: 0;">${proposal.title}</h2>
          <p><strong>Proposal Number:</strong> ${proposal.proposalNumber || "N/A"}</p>
          ${proposal.amount ? `<p><strong>Amount:</strong> ${currencySymbol}${proposal.amount.toFixed(2)}</p>` : ""}
          ${proposal.issueDate ? `<p><strong>Issue Date:</strong> ${new Date(proposal.issueDate).toLocaleDateString()}</p>` : ""}
          ${proposal.expiryDate ? `<p><strong>Expiry Date:</strong> ${new Date(proposal.expiryDate).toLocaleDateString()}</p>` : ""}
          ${proposal.description ? `<div style="margin-top: 15px;"><strong>Description:</strong><p>${proposal.description}</p></div>` : ""}
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${reviewUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; margin-bottom: 10px;">
            Review & Approve Proposal
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          Please click the link above to review the full proposal details and provide your approval. A PDF copy is attached to this email for your records. If you have any questions, please contact us.
        </p>
      </body>
    </html>
  `

  return sendEmail({
    to: clientEmail,
    subject: `Proposal Approval Request: ${proposal.title}`,
    html,
    attachments: attachments || undefined,
  })
}

// Approval Confirmation Email
export async function sendApprovalConfirmation(
  recipientEmail: string,
  recipientName: string,
  proposal: {
    title: string
    proposalNumber: string | null
  },
  approved: boolean,
  isClient: boolean
) {
  const status = approved ? "approved" : "rejected"
  const statusColor = approved ? "#10b981" : "#ef4444"
  const statusText = approved ? "Approved" : "Rejected"

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Proposal ${statusText}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="color: ${statusColor}; margin-top: 0;">Proposal ${statusText}</h1>
          <p>Hello ${recipientName},</p>
          <p>The following proposal has been ${status}:</p>
        </div>

        <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
          <h2 style="color: #111827; margin-top: 0;">${proposal.title}</h2>
          <p><strong>Proposal Number:</strong> ${proposal.proposalNumber || "N/A"}</p>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          ${isClient 
            ? "Thank you for your response. We will proceed accordingly." 
            : "The client has been notified of this decision."}
        </p>
      </body>
    </html>
  `

  return sendEmail({
    to: recipientEmail,
    subject: `Proposal ${statusText}: ${proposal.title}`,
    html,
  })
}

// Send Proposal Email with PDF
export async function sendProposalEmail(
  clientEmail: string,
  clientName: string,
  proposal: {
    id: string
    title: string
    proposalNumber: string | null
    description: string | null
    amount: number | null
    currency: string
  },
  pdfBuffer: Buffer
) {
  const proposalUrl = `${BASE_URL}/dashboard/proposals/${proposal.id}`
  const currencySymbol = getCurrencySymbol(proposal.currency)

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Proposal: ${proposal.title}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="color: #2563eb; margin-top: 0;">Proposal</h1>
          <p>Hello ${clientName},</p>
          <p>Please find attached the proposal for your review:</p>
        </div>

        <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #111827; margin-top: 0;">${proposal.title}</h2>
          <p><strong>Proposal Number:</strong> ${proposal.proposalNumber || "N/A"}</p>
          ${proposal.amount ? `<p><strong>Amount:</strong> ${currencySymbol}${proposal.amount.toFixed(2)}</p>` : ""}
          ${proposal.description ? `<div style="margin-top: 15px;"><strong>Description:</strong><p>${proposal.description}</p></div>` : ""}
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${proposalUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Proposal Online
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          The proposal PDF is attached to this email. If you have any questions, please contact us.
        </p>
      </body>
    </html>
  `

  const filename = proposal.proposalNumber 
    ? `proposal-${proposal.proposalNumber}.pdf`
    : `proposal-${proposal.id}.pdf`

  return sendEmail({
    to: clientEmail,
    subject: `Proposal: ${proposal.title}`,
    html,
    attachments: [{
      filename,
      content: pdfBuffer,
    }],
  })
}

// Send Invoice Email with PDF
export async function sendInvoiceEmail(
  clientEmail: string,
  clientName: string,
  invoice: {
    id: string
    invoiceNumber: string | null
    amount: number
    description: string | null
    dueDate: Date | null
    currency?: string
  },
  pdfBuffer: Buffer
) {
  const invoiceUrl = `${BASE_URL}/dashboard/bills/${invoice.id}`
  const currencySymbol = getCurrencySymbol(invoice.currency || "EUR")

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice ${invoice.invoiceNumber || invoice.id}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="color: #2563eb; margin-top: 0;">Invoice</h1>
          <p>Hello ${clientName},</p>
          <p>Please find attached your invoice:</p>
        </div>

        <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #111827; margin-top: 0;">Invoice ${invoice.invoiceNumber || invoice.id}</h2>
          <p><strong>Amount:</strong> ${currencySymbol}${invoice.amount.toFixed(2)}</p>
          ${invoice.dueDate ? `<p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>` : ""}
          ${invoice.description ? `<div style="margin-top: 15px;"><strong>Description:</strong><p>${invoice.description}</p></div>` : ""}
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${invoiceUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Invoice Online
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          The invoice PDF is attached to this email. Please remit payment by the due date.
        </p>
      </body>
    </html>
  `

  const filename = invoice.invoiceNumber 
    ? `invoice-${invoice.invoiceNumber}.pdf`
    : `invoice-${invoice.id}.pdf`

  return sendEmail({
    to: clientEmail,
    subject: `Invoice ${invoice.invoiceNumber || invoice.id}`,
    html,
    attachments: [{
      filename,
      content: pdfBuffer,
    }],
  })
}

// Send Payment Reminder Email
export async function sendPaymentReminderEmail(
  clientEmail: string,
  clientName: string,
  invoice: {
    id: string
    invoiceNumber: string | null
    amount: number
    dueDate: Date | null
    currency?: string
    daysOverdue?: number
  },
  reminderNumber: number = 1
) {
  const invoiceUrl = `${BASE_URL}/dashboard/bills/${invoice.id}`
  const currencySymbol = getCurrencySymbol(invoice.currency || "EUR")
  const daysText = invoice.daysOverdue 
    ? `${invoice.daysOverdue} day${invoice.daysOverdue !== 1 ? "s" : ""} overdue`
    : "past due"

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Reminder</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
          <h1 style="color: #d97706; margin-top: 0;">Payment Reminder</h1>
          <p>Hello ${clientName},</p>
          <p>This is a friendly reminder that the following invoice ${reminderNumber > 1 ? `(Reminder #${reminderNumber})` : ""} is ${daysText}:</p>
        </div>

        <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #111827; margin-top: 0;">Invoice ${invoice.invoiceNumber || invoice.id}</h2>
          <p><strong>Amount Due:</strong> <span style="font-size: 1.2em; font-weight: bold; color: #dc2626;">${currencySymbol}${invoice.amount.toFixed(2)}</span></p>
          ${invoice.dueDate ? `<p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>` : ""}
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${invoiceUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Invoice
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          Please remit payment at your earliest convenience. If you have already made payment, please disregard this notice.
        </p>
      </body>
    </html>
  `

  return sendEmail({
    to: clientEmail,
    subject: `Payment Reminder${reminderNumber > 1 ? ` #${reminderNumber}` : ""}: Invoice ${invoice.invoiceNumber || invoice.id}`,
    html,
  })
}

// Send Project Report Email with PDF
export async function sendProjectReportEmail(
  clientEmail: string,
  clientName: string,
  project: {
    id: string
    name: string
    description: string | null
  },
  pdfBuffer: Buffer
) {
  const projectUrl = `${BASE_URL}/dashboard/projects/${project.id}/reports`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Project Report: ${project.name}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="color: #2563eb; margin-top: 0;">Project Report</h1>
          <p>Hello ${clientName},</p>
          <p>Please find attached the project report:</p>
        </div>

        <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #111827; margin-top: 0;">${project.name}</h2>
          ${project.description ? `<p>${project.description}</p>` : ""}
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${projectUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Report Online
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          The project report PDF is attached to this email. If you have any questions, please contact us.
        </p>
      </body>
    </html>
  `

  const filename = `project-report-${project.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`

  return sendEmail({
    to: clientEmail,
    subject: `Project Report: ${project.name}`,
    html,
    attachments: [{
      filename,
      content: pdfBuffer,
    }],
  })
}

// Send User Notification Email
export async function sendUserNotificationEmail(
  userEmail: string,
  userName: string,
  notification: {
    title: string
    message: string
    type: string
    url?: string
  }
) {
  const url = notification.url || `${BASE_URL}/dashboard`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${notification.title}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="color: #2563eb; margin-top: 0;">${notification.title}</h1>
          <p>Hello ${userName},</p>
        </div>

        <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <p>${notification.message}</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${url}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Details
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          This is an automated notification. Please log in to your dashboard for more details.
        </p>
      </body>
    </html>
  `

  return sendEmail({
    to: userEmail,
    subject: notification.title,
    html,
  })
}

// Helper function to get currency symbol
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    CAD: "C$",
    AUD: "A$",
  }
  return symbols[currency] || currency
}




