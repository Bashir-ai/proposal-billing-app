import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ProposalStatus, UserRole } from "@prisma/client"
import { sendInternalApprovalRequest } from "@/lib/email"

const submitSchema = z.object({
  approverIds: z.array(z.string()).optional(), // Team members who need to approve
  approvalRequirement: z.enum(["ALL", "ANY", "MAJORITY"]).optional(), // Approval requirement type
})

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

    // Only proposal creator can submit
    if (proposal.createdBy !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only the proposal creator can submit it" },
        { status: 403 }
      )
    }

    // Only draft proposals can be submitted
    if (proposal.status !== ProposalStatus.DRAFT) {
      return NextResponse.json(
        { error: "Only draft proposals can be submitted" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = submitSchema.parse(body)

    const approverIds = validatedData.approverIds || []
    const approvalRequirement = validatedData.approvalRequirement || "ALL"
    const requiresInternalApproval = approverIds.length > 0

    // Validate approvers exist and are not clients
    if (requiresInternalApproval) {
      const approvers = await prisma.user.findMany({
        where: {
          id: { in: approverIds },
          role: { not: UserRole.CLIENT },
        },
      })

      if (approvers.length !== approverIds.length) {
        return NextResponse.json(
          { error: "One or more selected approvers are invalid" },
          { status: 400 }
        )
      }

      // Create approval records for each approver
      await prisma.approval.createMany({
        data: approverIds.map(approverId => ({
          proposalId: id,
          approverId,
          status: "PENDING",
        })),
        skipDuplicates: true,
      })

      // Send email notifications to approvers
      for (const approver of approvers) {
        try {
          await sendInternalApprovalRequest(approver.email, approver.name, {
            id: proposal.id,
            title: proposal.title,
            proposalNumber: proposal.proposalNumber,
            client: {
              name: proposal.client.name,
              company: proposal.client.company,
            },
            creator: {
              name: proposal.creator.name || proposal.creator.email,
            },
            amount: proposal.amount,
            currency: proposal.currency,
          })
        } catch (emailError) {
          console.error(`Failed to send email to ${approver.email}:`, emailError)
          // Continue with other emails even if one fails
        }
      }
    }

    // Update proposal status
    const updateData: any = {
      status: ProposalStatus.SUBMITTED,
      submittedAt: new Date(),
    }

    if (requiresInternalApproval) {
      updateData.internalApprovalRequired = true
      updateData.internalApprovalType = approvalRequirement
      updateData.requiredApproverIds = approverIds
      updateData.internalApprovalsComplete = false
    } else {
      // No internal approvals required, send directly to client
      updateData.internalApprovalRequired = false
      updateData.internalApprovalsComplete = true
      
      // Generate client approval token
      const crypto = await import("crypto")
      const approvalToken = crypto.randomBytes(32).toString("hex")
      const tokenExpiry = new Date()
      tokenExpiry.setDate(tokenExpiry.getDate() + 30) // 30 days expiry

      updateData.clientApprovalToken = approvalToken
      updateData.clientApprovalTokenExpiry = tokenExpiry

      // Send client approval email
      if (proposal.client.email) {
        const { sendClientApprovalRequest } = await import("@/lib/email")
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
          updateData.clientApprovalEmailSent = true
        } catch (emailError) {
          console.error("Failed to send client approval email:", emailError)
        }
      }
    }

    const updatedProposal = await prisma.proposal.update({
      where: { id },
      data: updateData,
      include: {
        client: true,
        creator: true,
        approvals: {
          include: {
            approver: {
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

    return NextResponse.json(updatedProposal)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error submitting proposal:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}

