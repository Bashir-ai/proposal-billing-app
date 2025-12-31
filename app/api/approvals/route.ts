import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ApprovalStatus, ProposalStatus, BillStatus, UserRole } from "@prisma/client"

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

    // Check if user can approve based on role hierarchy
    let canApprove = false
    if (validatedData.proposalId) {
      const proposal = await prisma.proposal.findUnique({
        where: { id: validatedData.proposalId },
        include: { creator: true },
      })

      if (!proposal) {
        return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
      }

      // Staff submits -> Manager approves
      // Manager submits -> Admin approves
      if (proposal.creator.role === "STAFF" && session.user.role === "MANAGER") {
        canApprove = true
      } else if (proposal.creator.role === "MANAGER" && session.user.role === "ADMIN") {
        canApprove = true
      } else if (session.user.role === "ADMIN") {
        canApprove = true
      }
    } else if (validatedData.billId) {
      const bill = await prisma.bill.findUnique({
        where: { id: validatedData.billId },
        include: { creator: true },
      })

      if (!bill) {
        return NextResponse.json({ error: "Bill not found" }, { status: 404 })
      }

      // Same logic for bills
      if (bill.creator.role === "STAFF" && session.user.role === "MANAGER") {
        canApprove = true
      } else if (bill.creator.role === "MANAGER" && session.user.role === "ADMIN") {
        canApprove = true
      } else if (session.user.role === "ADMIN") {
        canApprove = true
      }
    }

    if (!canApprove) {
      return NextResponse.json(
        { error: "You don't have permission to approve this item" },
        { status: 403 }
      )
    }

    // Create approval record
    const approval = await prisma.approval.create({
      data: {
        proposalId: validatedData.proposalId || null,
        billId: validatedData.billId || null,
        approverId: session.user.id,
        status: validatedData.status === "APPROVED" ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
        comments: validatedData.comments || null,
      },
    })

    // Update proposal or bill status
    if (validatedData.proposalId) {
      await prisma.proposal.update({
        where: { id: validatedData.proposalId },
        data: {
          status: validatedData.status === "APPROVED" ? ProposalStatus.APPROVED : ProposalStatus.REJECTED,
          approvedAt: validatedData.status === "APPROVED" ? new Date() : null,
        },
      })
    } else if (validatedData.billId) {
      await prisma.bill.update({
        where: { id: validatedData.billId },
        data: {
          status: validatedData.status === "APPROVED" ? BillStatus.APPROVED : BillStatus.REJECTED,
          approvedAt: validatedData.status === "APPROVED" ? new Date() : null,
        },
      })
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



