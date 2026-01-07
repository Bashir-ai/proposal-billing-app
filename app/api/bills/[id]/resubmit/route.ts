export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { BillStatus, UserRole } from "@prisma/client"

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

    const invoice = await prisma.bill.findUnique({
      where: { id },
      include: {
        client: true,
        creator: true,
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    if (invoice.status !== BillStatus.SUBMITTED) {
      return NextResponse.json(
        { error: "Only submitted invoices can be resubmitted" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = resubmitSchema.parse(body)

    const approverIds = validatedData.approverIds || []

    // Delete existing approvals
    await prisma.approval.deleteMany({
      where: { billId: id },
    })

    // Validate approvers exist and are not clients
    if (approverIds.length > 0) {
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
          billId: id,
          approverId,
          status: "PENDING",
        })),
        skipDuplicates: true,
      })
    }

    // Update invoice with resubmission tracking
    const updatedInvoice = await prisma.bill.update({
      where: { id },
      data: {
        resubmittedAt: new Date(),
        resubmittedBy: session.user.id,
        resubmissionCount: invoice.resubmissionCount + 1,
      },
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

    return NextResponse.json(updatedInvoice)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error resubmitting invoice:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}





