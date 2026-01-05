import { Resend } from "resend"

// Initialize Resend client
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@example.com"
const BASE_URL = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
}

export async function sendEmail({ to, subject, html, from = FROM_EMAIL }: SendEmailOptions) {
  if (!resend) {
    console.warn("Resend API key not configured. Email not sent.")
    console.log("Would send email:", { to, subject, from })
    return { success: false, error: "Email service not configured" }
  }

  try {
    const result = await resend.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    })

    return { success: true, data: result }
  } catch (error: any) {
    console.error("Error sending email:", error)
    return { success: false, error: error.message }
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

// Client Approval Request Email
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
  },
  approvalToken: string
) {
  const approveUrl = `${BASE_URL}/approve/${approvalToken}?action=approve`
  const rejectUrl = `${BASE_URL}/approve/${approvalToken}?action=reject`
  const currencySymbol = getCurrencySymbol(proposal.currency)

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
          <a href="${approveUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; margin-right: 10px;">
            Approve Proposal
          </a>
          <a href="${rejectUrl}" style="background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Reject Proposal
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          You can also review the full proposal details by clicking the links above. If you have any questions, please contact us.
        </p>
      </body>
    </html>
  `

  return sendEmail({
    to: clientEmail,
    subject: `Proposal Approval Request: ${proposal.title}`,
    html,
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



