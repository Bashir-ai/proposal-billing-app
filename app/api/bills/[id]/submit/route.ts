import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { BillStatus, UserRole } from "@prisma/client"
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

    const bill = await prisma.bill.findUnique({
      where: { id },
      include: {
        client: true,
        creator: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        proposal: {
          select: {
            id: true,
            title: true,
            proposalNumber: true,
          },
        },
      },
    })

    if (!bill) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Only invoice creator can submit
    if (bill.createdBy !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only the invoice creator can submit it" },
        { status: 403 }
      )
    }

    // Only draft invoices can be submitted
    if (bill.status !== BillStatus.DRAFT) {
      return NextResponse.json(
        { error: "Only draft invoices can be submitted" },
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
          billId: id,
          approverId,
          status: "PENDING",
        })),
        skipDuplicates: true,
      })

      // Send email notifications to approvers
      for (const approver of approvers) {
        try {
          await sendInternalApprovalRequest(approver.email, approver.name, {
            id: bill.id,
            title: `Invoice ${bill.invoiceNumber || bill.id}`,
            proposalNumber: bill.invoiceNumber ?? null,
            client: {
              name: bill.client.name,
              company: bill.client.company ?? null,
            },
            creator: {
              name: bill.creator.name || bill.creator.email,
            },
            amount: bill.amount,
            currency: "EUR", // TODO: get from project/proposal
          })
        } catch (emailError) {
          console.error(`Failed to send email to ${approver.email}:`, emailError)
          // Continue with other emails even if one fails
        }
      }
    }

    // Update invoice status
    const updateData: any = {
      status: BillStatus.SUBMITTED,
      submittedAt: new Date(),
    }

    if (requiresInternalApproval) {
      updateData.internalApprovalRequired = true
      updateData.internalApprovalType = approvalRequirement
      updateData.requiredApproverIds = approverIds
      updateData.internalApprovalsComplete = false
    } else {
      // No internal approvals required, mark as complete
      updateData.internalApprovalRequired = false
      updateData.internalApprovalsComplete = true
    }

    const updatedBill = await prisma.bill.update({
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

    return NextResponse.json(updatedBill)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error submitting invoice:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}



