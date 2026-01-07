export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ApprovalStatus, ProposalStatus, BillStatus, UserRole } from "@prisma/client"
import { canApproveProposals, canApproveInvoices } from "@/lib/permissions"

const approvalSchema = z.object({
  proposalId: z.string().optional(),
  billId: z.string().optional(),
  status: z.enum(["APPROVED", "REJECTED"]),
  comments: z.string().optional(),
})

export async function POST(request: Request) {
  try {
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

    const body = await request.json()
    const validatedData = approvalSchema.parse(body)

    if (!validatedData.proposalId && !validatedData.billId) {
      return NextResponse.json(
        { error: "Either proposalId or billId is required" },
        { status: 400 }
      )
    }

    // Check if user can approve based on permissions
    let canApprove = false
    if (validatedData.proposalId) {
      const proposal = await prisma.proposal.findUnique({
        where: { id: validatedData.proposalId },
        include: { creator: true },
      })

      if (!proposal) {
        return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
      }

      // Get user with permissions
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          role: true,
          canApproveProposals: true,
        },
      })

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }

      // Check if this is a new workflow (with requiredApproverIds) or old workflow
      if (proposal.internalApprovalRequired && proposal.requiredApproverIds && proposal.requiredApproverIds.length > 0) {
        // New workflow: user must be in the required approvers list OR have permission override
        canApprove = proposal.requiredApproverIds.includes(session.user.id) || canApproveProposals(user)
      } else {
        // Old workflow: check permission function
        canApprove = canApproveProposals(user)
      }
    } else if (validatedData.billId) {
      const bill = await prisma.bill.findUnique({
        where: { id: validatedData.billId },
        include: { creator: true },
      })

      if (!bill) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
      }

      // Get user with permissions
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          role: true,
          canApproveInvoices: true,
        },
      })

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }

      // Check if this is a new workflow (with requiredApproverIds) or old workflow
      if (bill.internalApprovalRequired && bill.requiredApproverIds && bill.requiredApproverIds.length > 0) {
        // New workflow: user must be in the required approvers list OR have permission override
        canApprove = bill.requiredApproverIds.includes(session.user.id) || canApproveInvoices(user)
      } else {
        // Old workflow: check permission function
        canApprove = canApproveInvoices(user)
      }
    }

    if (!canApprove) {
      return NextResponse.json(
        { error: "You don't have permission to approve this item" },
        { status: 403 }
      )
    }

    // Check if approval already exists (to prevent duplicates)
    let approval
    if (validatedData.proposalId) {
      approval = await prisma.approval.findFirst({
        where: {
          proposalId: validatedData.proposalId,
          approverId: session.user.id,
        },
      })
    } else if (validatedData.billId) {
      approval = await prisma.approval.findFirst({
        where: {
          billId: validatedData.billId,
          approverId: session.user.id,
        },
      })
    }

    // Update existing approval or create new one
    if (approval) {
      approval = await prisma.approval.update({
        where: { id: approval.id },
        data: {
          status: validatedData.status === "APPROVED" ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
          comments: validatedData.comments || null,
        },
      })
    } else {
      approval = await prisma.approval.create({
        data: {
          proposalId: validatedData.proposalId || null,
          billId: validatedData.billId || null,
          approverId: session.user.id,
          status: validatedData.status === "APPROVED" ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
          comments: validatedData.comments || null,
        },
      })
    }

    // Handle proposal approval workflow
    if (validatedData.proposalId) {
      const proposal = await prisma.proposal.findUnique({
        where: { id: validatedData.proposalId },
        include: {
          client: true,
          approvals: true,
        },
      })

      if (!proposal) {
        return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
      }

      // If rejected, update proposal status immediately
      if (validatedData.status === "REJECTED") {
        await prisma.proposal.update({
          where: { id: validatedData.proposalId },
          data: {
            status: ProposalStatus.REJECTED,
            approvedAt: null,
          },
        })
      } else {
        // Check if internal approvals are complete
        if (proposal.internalApprovalRequired && !proposal.internalApprovalsComplete) {
          const requiredApproverIds = proposal.requiredApproverIds || []
          const approvalType = proposal.internalApprovalType || "ALL"
          
          // Get all approvals for this proposal
          const allApprovals = proposal.approvals.filter(a => 
            requiredApproverIds.includes(a.approverId)
          )
          
          const approvedCount = allApprovals.filter(a => a.status === ApprovalStatus.APPROVED).length
          const rejectedCount = allApprovals.filter(a => a.status === ApprovalStatus.REJECTED).length
          const totalRequired = requiredApproverIds.length
          
          let approvalsComplete = false
          
          if (approvalType === "ALL") {
            approvalsComplete = approvedCount === totalRequired
          } else if (approvalType === "ANY") {
            approvalsComplete = approvedCount >= 1
          } else if (approvalType === "MAJORITY") {
            approvalsComplete = approvedCount > totalRequired / 2
          }
          
          // If any rejection and requirement is ALL, mark as rejected
          if (rejectedCount > 0 && approvalType === "ALL") {
            await prisma.proposal.update({
              where: { id: validatedData.proposalId },
              data: {
                status: ProposalStatus.REJECTED,
                internalApprovalsComplete: false,
                approvedAt: null,
              },
            })
          } else if (approvalsComplete) {
            // All required approvals received, send to client
            const crypto = await import("crypto")
            const approvalToken = crypto.randomBytes(32).toString("hex")
            const tokenExpiry = new Date()
            tokenExpiry.setDate(tokenExpiry.getDate() + 30) // 30 days expiry

            await prisma.proposal.update({
              where: { id: validatedData.proposalId },
              data: {
                internalApprovalsComplete: true,
                clientApprovalToken: approvalToken,
                clientApprovalTokenExpiry: tokenExpiry,
              },
            })

            // Send client approval email
            if (proposal.client && proposal.client.email) {
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
                
                await prisma.proposal.update({
                  where: { id: validatedData.proposalId },
                  data: {
                    clientApprovalEmailSent: true,
                  },
                })
              } catch (emailError) {
                console.error("Failed to send client approval email:", emailError)
              }
            }
          }
        } else if (!proposal.internalApprovalRequired) {
          // No internal approvals required, update status directly
          await prisma.proposal.update({
            where: { id: validatedData.proposalId },
            data: {
              status: ProposalStatus.APPROVED,
              approvedAt: new Date(),
            },
          })
        }
      }
    } else if (validatedData.billId) {
      // Handle invoice approval workflow
      const bill = await prisma.bill.findUnique({
        where: { id: validatedData.billId },
        include: {
          approvals: true,
        },
      })

      if (!bill) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
      }

      // If rejected, update invoice status immediately
      if (validatedData.status === "REJECTED") {
        await prisma.bill.update({
          where: { id: validatedData.billId },
          data: {
            status: BillStatus.DRAFT, // Revert to draft on rejection
            approvedAt: null,
            internalApprovalsComplete: false,
          },
        })
        // Early return after handling rejection
        return NextResponse.json(approval, { status: 201 })
      }

      // Handle approval (status is "APPROVED" at this point)
      // Check if internal approvals are complete
      if (bill.internalApprovalRequired && !bill.internalApprovalsComplete) {
        const requiredApproverIds = bill.requiredApproverIds || []
        const approvalType = bill.internalApprovalType || "ALL"
        
        // Get all approvals for this invoice
        const allApprovals = bill.approvals.filter(a => 
          requiredApproverIds.includes(a.approverId)
        )
        
        const approvedCount = allApprovals.filter(a => a.status === ApprovalStatus.APPROVED).length
        const rejectedCount = allApprovals.filter(a => a.status === ApprovalStatus.REJECTED).length
        const totalRequired = requiredApproverIds.length
        
        let approvalsComplete = false
        
        if (approvalType === "ALL") {
          approvalsComplete = approvedCount === totalRequired
        } else if (approvalType === "ANY") {
          approvalsComplete = approvedCount >= 1
        } else if (approvalType === "MAJORITY") {
          approvalsComplete = approvedCount > totalRequired / 2
        }
        
        // If any rejection and requirement is ALL, revert to draft
        if (rejectedCount > 0 && approvalType === "ALL") {
          await prisma.bill.update({
            where: { id: validatedData.billId },
            data: {
              status: BillStatus.DRAFT,
              internalApprovalsComplete: false,
              approvedAt: null,
            },
          })
        } else if (approvalsComplete) {
          // All required approvals received, mark as approved
          await prisma.bill.update({
            where: { id: validatedData.billId },
            data: {
              status: BillStatus.APPROVED,
              internalApprovalsComplete: true,
              approvedAt: new Date(),
            },
          })
        }
      } else if (!bill.internalApprovalRequired) {
        // No internal approvals required, update status directly to approved
        await prisma.bill.update({
          where: { id: validatedData.billId },
          data: {
            status: BillStatus.APPROVED,
            approvedAt: new Date(),
          },
        })
      }
    }

    return NextResponse.json(approval, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}




