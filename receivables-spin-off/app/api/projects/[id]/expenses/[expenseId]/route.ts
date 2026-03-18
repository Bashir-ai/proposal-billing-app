export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { isDatabaseConnectionError, getDatabaseErrorMessage } from "@/lib/database-error-handler"
import { parseLocalDate } from "@/lib/utils"

const expenseUpdateSchema = z.object({
  description: z.string().min(1).optional(),
  amount: z.number().min(0).optional(),
  currency: z.string().optional(),
  expenseDate: z.string().optional(),
  category: z.string().optional().nullable(),
  isBillable: z.boolean().optional(),
  isReimbursement: z.boolean().optional(),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const { id, expenseId } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role === "CLIENT" || session.user.role === "EXTERNAL") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const expense = await prisma.projectExpense.findUnique({
      where: { id: expenseId },
    })

    if (!expense || expense.projectId !== id) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = expenseUpdateSchema.parse(body)

    const updateData: any = {}
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description
    }
    if (validatedData.amount !== undefined) {
      updateData.amount = validatedData.amount
    }
    if (validatedData.currency !== undefined) {
      updateData.currency = validatedData.currency
    }
    if (validatedData.expenseDate !== undefined) {
      updateData.expenseDate = parseLocalDate(validatedData.expenseDate)
    }
    if (validatedData.category !== undefined) {
      updateData.category = validatedData.category
    }
    if (validatedData.isBillable !== undefined) {
      updateData.isBillable = validatedData.isBillable
    }
    if (validatedData.isReimbursement !== undefined) {
      updateData.isReimbursement = validatedData.isReimbursement
    }

    const updatedExpense = await prisma.projectExpense.update({
      where: { id: expenseId },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(updatedExpense)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        {
          error: "Database connection error",
          message: getDatabaseErrorMessage()
        },
        { status: 503 }
      )
    }

    console.error("Error updating expense:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const { id, expenseId } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only ADMIN can delete expenses
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden. Only admins can delete expenses." },
        { status: 403 }
      )
    }

    const expense = await prisma.projectExpense.findUnique({
      where: { id: expenseId },
    })

    if (!expense || expense.projectId !== id) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    await prisma.projectExpense.delete({
      where: { id: expenseId },
    })

    return NextResponse.json({ success: true, message: "Expense deleted" })
  } catch (error: any) {
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        {
          error: "Database connection error",
          message: getDatabaseErrorMessage()
        },
        { status: 503 }
      )
    }
    console.error("Error deleting expense:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}
