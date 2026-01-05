import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ProposalStatus, UserRole } from "@prisma/client"
import { sendInternalApprovalRequest } from "@/lib/email"

const resubmitSchema = z.object({
  approverIds: z.array(z.string()).optional(),
  approvalRequirement: z.enum(["ALL", "ANY", "MAJORITY"]).optional(),
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

    if (proposal.status !== ProposalStatus.SUBMITTED) {
      return NextResponse.json(
        { error: "Only submitted proposals can be resubmitted" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = resubmitSchema.parse(body)

    const approverIds = validatedData.approverIds || []
    const approvalRequirement = validatedData.approvalRequirement || "ALL"
    const requiresInternalApproval = approverIds && approverIds.length > 0

    // Delete existing approvals
    await prisma.approval.deleteMany({
      where: { proposalId: id },
    })

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

      // Create new approval records for each approver
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
        }
      }
    }

    // Update proposal with resubmission tracking
    const updateData: any = {
      resubmittedAt: new Date(),
      resubmittedBy: session.user.id,
      resubmissionCount: proposal.resubmissionCount + 1,
      internalApprovalsComplete: false,
    }

    if (requiresInternalApproval) {
      updateData.internalApprovalRequired = true
      updateData.internalApprovalType = approvalRequirement
      updateData.requiredApproverIds = approverIds
    } else {
      updateData.internalApprovalRequired = false
      updateData.internalApprovalsComplete = true
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

    console.error("Error resubmitting proposal:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}



