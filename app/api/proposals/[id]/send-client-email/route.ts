import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendClientApprovalRequest } from "@/lib/email"

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
        creator: true,
      },
    })

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    // Check if internal approvals are complete
    if (proposal.internalApprovalRequired && !proposal.internalApprovalsComplete) {
      return NextResponse.json(
        { error: "Cannot send client approval email until all internal approvals are complete" },
        { status: 400 }
      )
    }

    // Check if client email exists
    if (!proposal.client || !proposal.client.email) {
      return NextResponse.json(
        { error: "Client email is not set. Please update the client information first." },
        { status: 400 }
      )
    }

    // Generate or reuse approval token (TypeScript now knows proposal.client is not null)
    let approvalToken = proposal.clientApprovalToken
    if (!approvalToken || (proposal.clientApprovalTokenExpiry && new Date() > proposal.clientApprovalTokenExpiry)) {
      const cryptoModule = await import("crypto")
      approvalToken = cryptoModule.randomBytes(32).toString("hex")
    }

    const tokenExpiry = new Date()
    tokenExpiry.setDate(tokenExpiry.getDate() + 30) // 30 days expiry

    // Send email
    try {
      await sendClientApprovalRequest(
        proposal.client.email,
        proposal.client.name,
        {
          id: proposal.id,
          title: proposal.title,
          proposalNumber: proposal.proposalNumber,
          description: proposal.description,
          amount: proposal.amount,
          currency: proposal.currency,
          issueDate: proposal.issueDate,
          expiryDate: proposal.expiryDate,
        },
        approvalToken
      )
    } catch (emailError: any) {
      console.error("Failed to send client approval email:", emailError)
      return NextResponse.json(
        { error: "Failed to send email", message: emailError.message },
        { status: 500 }
      )
    }

    // Update proposal
    const updatedProposal = await prisma.proposal.update({
      where: { id },
      data: {
        clientApprovalEmailSent: true,
        clientApprovalToken: approvalToken,
        clientApprovalTokenExpiry: tokenExpiry,
        clientApprovalStatus: "PENDING",
      },
    })

    return NextResponse.json({
      success: true,
      message: "Client approval email sent successfully",
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

