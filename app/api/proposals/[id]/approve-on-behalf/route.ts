import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ClientApprovalStatus, UserRole, ProposalStatus, ProjectStatus } from "@prisma/client"
import { sendApprovalConfirmation } from "@/lib/email"

const approveOnBehalfSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().optional(), // Optional reason for approving on behalf
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

    // Only ADMIN or MANAGER can approve on behalf
    if (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.MANAGER) {
      return NextResponse.json(
        { error: "Only administrators and managers can approve on behalf of clients" },
        { status: 403 }
      )
    }

    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        client: true,
        creator: true,
        projects: true,
      },
    })

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    // Check if internal approvals are complete
    if (proposal.internalApprovalRequired && !proposal.internalApprovalsComplete) {
      return NextResponse.json(
        { error: "Cannot approve on behalf of client until all internal approvals are complete" },
        { status: 400 }
      )
    }

    // Allow overriding any client approval status (PENDING, APPROVED, REJECTED)
    // No need to check current status - admins/managers can change it

    const body = await request.json()
    const validatedData = approveOnBehalfSchema.parse(body)

    // Update proposal status
    const updateData: any = {
      clientApprovalStatus: validatedData.action === "approve" 
        ? ClientApprovalStatus.APPROVED 
        : ClientApprovalStatus.REJECTED,
    }

    if (validatedData.action === "approve") {
      updateData.clientApprovedAt = new Date()
      updateData.status = ProposalStatus.APPROVED
      updateData.approvedAt = new Date()
    } else {
      updateData.clientRejectedAt = new Date()
      updateData.status = ProposalStatus.REJECTED
      if (validatedData.reason) {
        updateData.clientRejectionReason = validatedData.reason
      }
    }

    const updatedProposal = await prisma.proposal.update({
      where: { id },
      data: updateData,
      include: {
        client: true,
        creator: true,
        projects: true,
      },
    })

    // Auto-create project if approved and no project exists
    if (validatedData.action === "approve" && updatedProposal.projects.length === 0) {
      try {
        await prisma.project.create({
          data: {
            name: updatedProposal.title,
            clientId: updatedProposal.clientId,
            proposalId: updatedProposal.id,
            description: updatedProposal.description || null,
            status: ProjectStatus.ACTIVE,
            currency: updatedProposal.currency || "EUR",
            startDate: new Date(),
          },
        })
      } catch (projectError) {
        console.error("Failed to auto-create project:", projectError)
        // Don't fail the approval if project creation fails
      }
    }

    // Send notification email to client
    if (proposal.client.email) {
      try {
        await sendApprovalConfirmation(
          proposal.client.email,
          proposal.client.name,
          {
            title: proposal.title,
            proposalNumber: proposal.proposalNumber,
          },
          validatedData.action === "approve",
          true
        )
      } catch (emailError) {
        console.error("Failed to send notification email to client:", emailError)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Proposal ${validatedData.action === "approve" ? "approved" : "rejected"} on behalf of client successfully`,
      proposal: updatedProposal,
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error approving on behalf of client:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}

