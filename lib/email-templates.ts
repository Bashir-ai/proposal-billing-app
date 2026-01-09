import { prisma } from "@/lib/prisma"

export interface TemplateVariables {
  proposal?: {
    id?: string
    title?: string
    number?: string | null
    description?: string | null
    amount?: number | null
    currency?: string
    issueDate?: Date | null
    expiryDate?: Date | null
  }
  invoice?: {
    id?: string
    number?: string | null
    amount?: number | null
    currency?: string
    dueDate?: Date | null
  }
  client?: {
    name?: string
    company?: string | null
    email?: string | null
  }
  lead?: {
    name?: string
    company?: string | null
    email?: string | null
  }
  approvalLink?: string
  reviewLink?: string
  pdfLink?: string
}

/**
 * Get the default template for a given type
 */
export async function getDefaultTemplate(type: "PROPOSAL" | "INVOICE" | "OTHER") {
  const template = await prisma.emailTemplate.findFirst({
    where: {
      type,
      isDefault: true,
    },
  })

  if (!template) {
    // Return a basic default template if none exists
    if (type === "PROPOSAL") {
      return {
        subject: "Proposal Approval Request: {{proposal.title}}",
        body: `
          <p>Hello {{client.name}} or {{lead.name}},</p>
          <p>We are pleased to present the following proposal for your review and approval:</p>
          <h2>{{proposal.title}}</h2>
          <p><strong>Proposal Number:</strong> {{proposal.number}}</p>
          {{#if proposal.amount}}<p><strong>Amount:</strong> {{proposal.amount}}</p>{{/if}}
          <p><a href="{{reviewLink}}">Review & Approve Proposal</a></p>
          <p>A PDF copy is attached to this email for your records.</p>
        `,
      }
    } else if (type === "INVOICE") {
      return {
        subject: "Invoice: {{invoice.number}}",
        body: `
          <p>Hello {{client.name}},</p>
          <p>Please find attached invoice {{invoice.number}} for your review.</p>
          {{#if invoice.amount}}<p><strong>Amount:</strong> {{invoice.amount}}</p>{{/if}}
        `,
      }
    }
  }

  return template
}

/**
 * Render a template with variables
 */
export function renderTemplate(
  template: string,
  variables: TemplateVariables
): string {
  let rendered = template

  // Replace variables - simple {{variable}} syntax
  const replacements: Array<{ pattern: RegExp; value: string }> = []

  if (variables.proposal) {
    if (variables.proposal.title) replacements.push({ pattern: /\{\{proposal\.title\}\}/g, value: variables.proposal.title })
    if (variables.proposal.number !== undefined) replacements.push({ pattern: /\{\{proposal\.number\}\}/g, value: variables.proposal.number || "N/A" })
    if (variables.proposal.description) replacements.push({ pattern: /\{\{proposal\.description\}\}/g, value: variables.proposal.description })
    if (variables.proposal.amount !== undefined && variables.proposal.amount !== null && variables.proposal.currency) {
      const symbol = getCurrencySymbol(variables.proposal.currency)
      replacements.push({ pattern: /\{\{proposal\.amount\}\}/g, value: `${symbol}${variables.proposal.amount.toFixed(2)}` })
    }
  }

  if (variables.invoice) {
    if (variables.invoice.number !== undefined) replacements.push({ pattern: /\{\{invoice\.number\}\}/g, value: variables.invoice.number || "N/A" })
    if (variables.invoice.amount !== undefined && variables.invoice.amount !== null && variables.invoice.currency) {
      const symbol = getCurrencySymbol(variables.invoice.currency)
      replacements.push({ pattern: /\{\{invoice\.amount\}\}/g, value: `${symbol}${variables.invoice.amount.toFixed(2)}` })
    }
  }

  if (variables.client) {
    if (variables.client.name) replacements.push({ pattern: /\{\{client\.name\}\}/g, value: variables.client.name })
    if (variables.client.company) replacements.push({ pattern: /\{\{client\.company\}\}/g, value: variables.client.company })
  }

  if (variables.lead) {
    if (variables.lead.name) replacements.push({ pattern: /\{\{lead\.name\}\}/g, value: variables.lead.name })
    if (variables.lead.company) replacements.push({ pattern: /\{\{lead\.company\}\}/g, value: variables.lead.company })
  }

  if (variables.approvalLink) {
    replacements.push({ pattern: /\{\{approvalLink\}\}/g, value: variables.approvalLink })
  }

  if (variables.reviewLink) {
    // Ensure reviewLink is always replaced - use a more specific pattern
    const reviewLinkPattern = /\{\{reviewLink\}\}/g
    if (rendered.match(reviewLinkPattern)) {
      replacements.push({ pattern: reviewLinkPattern, value: variables.reviewLink })
      console.log("Adding reviewLink replacement:", { reviewLink: variables.reviewLink })
    }
  }

  if (variables.pdfLink) {
    replacements.push({ pattern: /\{\{pdfLink\}\}/g, value: variables.pdfLink })
  }

  // Handle conditional blocks (simple {{#if variable}}...{{/if}})
  // For client/lead name fallback
  const conditionalPattern = /\{\{#if (\w+\.\w+)\}\}(.*?)(?:\{\{else\}\}(.*?))?\{\{\/if\}\}/g
  rendered = rendered.replace(conditionalPattern, (match, varPath, ifBlock, elseBlock) => {
    const parts = varPath.split('.')
    if (parts[0] === 'client' && parts[1] === 'name') {
      return variables.client?.name ? ifBlock : (elseBlock || "")
    }
    if (parts[0] === 'lead' && parts[1] === 'name') {
      return variables.lead?.name ? ifBlock : (elseBlock || "")
    }
    return match // Return unchanged if we don't recognize the variable
  })

  // Handle "{{client.name}} or {{lead.name}}" pattern
  if (variables.client?.name || variables.lead?.name) {
    const clientOrLeadName = variables.client?.name || variables.lead?.name || ""
    rendered = rendered.replace(/\{\{client\.name\}\}\s+or\s+\{\{lead\.name\}\}/g, clientOrLeadName)
    rendered = rendered.replace(/\{\{lead\.name\}\}\s+or\s+\{\{client\.name\}\}/g, clientOrLeadName)
  }

  // Apply all replacements
  replacements.forEach(({ pattern, value }) => {
    rendered = rendered.replace(pattern, value)
  })

  // Remove any remaining unmatched variables, but preserve reviewLink and approvalLink if they exist
  // This prevents accidentally removing important links
  rendered = rendered.replace(/\{\{(?!reviewLink|approvalLink)[^}]+\}\}/g, "")

  return rendered
}

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
