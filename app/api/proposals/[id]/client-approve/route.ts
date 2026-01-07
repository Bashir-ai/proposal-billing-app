import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ClientApprovalStatus, ProposalStatus, ProjectStatus } from "@prisma/client"
import { sendApprovalConfirmation } from "@/lib/email"

const clientApprovalSchema = z.object({
  token: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  reason: z.string().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const validatedData = clientApprovalSchema.parse(body)

    // Find proposal by token
    const proposal = await prisma.proposal.findFirst({
      where: {
        id,
        clientApprovalToken: validatedData.token,
      },
      include: {
        client: true,
        creator: true,
      },
    })

    if (!proposal) {
      return NextResponse.json(
        { error: "Invalid approval token or proposal not found" },
        { status: 404 }
      )
    }

    // Check if token is expired
    if (proposal.clientApprovalTokenExpiry && new Date() > proposal.clientApprovalTokenExpiry) {
      return NextResponse.json(
        { error: "Approval token has expired. Please request a new approval link." },
        { status: 400 }
      )
    }

    // Check if already approved/rejected
    if (proposal.clientApprovalStatus !== ClientApprovalStatus.PENDING) {
      return NextResponse.json(
        { error: `Proposal has already been ${proposal.clientApprovalStatus.toLowerCase()}` },
        { status: 400 }
      )
    }

    // Update proposal status
    const updateData: any = {
      clientApprovalStatus: validatedData.action === "approve" 
        ? ClientApprovalStatus.APPROVED 
        : ClientApprovalStatus.REJECTED,
      clientApprovalToken: null, // Invalidate token after use
      clientApprovalTokenExpiry: null,
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
      // Ensure clientId exists before creating project (Project requires non-null clientId)
      const clientId = updatedProposal.clientId
      if (clientId) {
        try {
          await prisma.project.create({
            data: {
              name: updatedProposal.title,
              clientId: clientId, // TypeScript now knows this is string, not null
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
    }

    // Send confirmation emails
    try {
      // Email to client
      if (proposal.client && proposal.client.email) {
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
      }

      // Email to proposal creator
      if (proposal.creator.email) {
        await sendApprovalConfirmation(
          proposal.creator.email,
          proposal.creator.name,
          {
            title: proposal.title,
            proposalNumber: proposal.proposalNumber,
          },
          validatedData.action === "approve",
          false
        )
      }
    } catch (emailError) {
      console.error("Failed to send confirmation emails:", emailError)
      // Don't fail the request if emails fail
    }

    return NextResponse.json({
      success: true,
      message: `Proposal ${validatedData.action === "approve" ? "approved" : "rejected"} successfully`,
      proposal: updatedProposal,
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error processing client approval:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}

