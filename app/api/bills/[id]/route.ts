import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { BillStatus } from "@prisma/client"

const billUpdateSchema = z.object({
  amount: z.number().min(0).optional(),
  dueDate: z.string().optional(),
  status: z.nativeEnum(BillStatus).optional(),
})

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

    const bill = await prisma.bill.findUnique({
      where: { id },
      include: {
        client: true,
        proposal: {
          include: {
            items: true,
          },
        },
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
        approvals: {
          include: {
            approver: {
              select: {
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!bill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 })
    }

    // Check if client can access this bill
    if (session.user.role === "CLIENT") {
      const client = await prisma.client.findFirst({
        where: { email: session.user.email },
      })
      if (!client || bill.clientId !== client.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    return NextResponse.json(bill)
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(
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
    })

    if (!bill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 })
    }

    // Only allow editing drafts
    if (bill.status !== BillStatus.DRAFT && bill.createdBy !== session.user.id) {
      return NextResponse.json(
        { error: "Can only edit draft bills" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = billUpdateSchema.parse(body)

    const updatedBill = await prisma.bill.update({
      where: { id },
      data: {
        amount: validatedData.amount,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : bill.dueDate,
        status: validatedData.status,
        submittedAt: validatedData.status === BillStatus.SUBMITTED ? new Date() : bill.submittedAt,
      },
      include: {
        client: true,
        proposal: true,
      },
    })

    return NextResponse.json(updatedBill)
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

    const body = await request.json()
    const action = body.action

    if (action === "submit") {
      const bill = await prisma.bill.update({
        where: { id },
        data: {
          status: BillStatus.SUBMITTED,
          submittedAt: new Date(),
        },
      })

      return NextResponse.json(bill)
    } else if (action === "markPaid") {
      if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        )
      }

      const bill = await prisma.bill.update({
        where: { id },
        data: {
          status: BillStatus.PAID,
          paidAt: new Date(),
        },
      })

      return NextResponse.json(bill)
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

