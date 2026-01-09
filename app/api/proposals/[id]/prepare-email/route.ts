export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getDefaultTemplate, renderTemplate } from "@/lib/email-templates"

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

    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

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
      },
    })

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    // Get or generate approval token
    let approvalToken = proposal.clientApprovalToken
    if (!approvalToken || (proposal.clientApprovalTokenExpiry && new Date() > proposal.clientApprovalTokenExpiry)) {
      const cryptoModule = await import("crypto")
      approvalToken = cryptoModule.randomBytes(32).toString("hex")
    }

    const BASE_URL = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const reviewUrl = `${BASE_URL}/proposals/${proposal.id}/review?token=${approvalToken}`

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

    const subject = renderTemplate(finalTemplate.subject || `Proposal Approval Request: ${proposal.title}`, variables)
    const body = renderTemplate(finalTemplate.body || "", variables)

    return NextResponse.json({
      subject,
      body,
    })
  } catch (error: any) {
    console.error("Error preparing email:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}
