export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { UserRole } from "@prisma/client"

const updateExpenseSchema = z.object({
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  currency: z.string().optional(),
  expenseDate: z.string().transform((str) => new Date(str)).optional(),
  category: z.string().nullable().optional(),
  receiptPath: z.string().nullable().optional(),
  isBillable: z.boolean().optional(),
  isReimbursement: z.boolean().optional(),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only staff can update expenses
    if (session.user.role === UserRole.CLIENT) {
      return NextResponse.json({ error: "Forbidden - Staff access required" }, { status: 403 })
    }

    const { id, expenseId } = await params
    const projectId = id
    const body = await request.json()
    const validatedData = updateExpenseSchema.parse(body)

    // Verify expense belongs to project
    const existingExpense = await prisma.projectExpense.findFirst({
      where: {
        id: expenseId,
        projectId,
      },
    })

    if (!existingExpense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    // Don't allow editing if already billed
    if (existingExpense.billedAt) {
      return NextResponse.json({ error: "Cannot edit expense that has already been billed" }, { status: 400 })
    }

    // Update expense
    const expense = await prisma.projectExpense.update({
      where: { id: expenseId },
      data: {
        description: validatedData.description,
        amount: validatedData.amount,
        currency: validatedData.currency,
        expenseDate: validatedData.expenseDate,
        category: validatedData.category,
        receiptPath: validatedData.receiptPath,
        isBillable: validatedData.isBillable,
        isReimbursement: validatedData.isReimbursement,
      },
    })

    return NextResponse.json({ expense })
  } catch (error: any) {
    console.error("Error updating expense:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }
    return NextResponse.json(
      { error: error.message || "Failed to update expense" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins and managers can delete expenses
    if (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.MANAGER) {
      return NextResponse.json({ error: "Forbidden - Admin or Manager access required" }, { status: 403 })
    }

    const { id, expenseId } = await params
    const projectId = id

    // Verify expense belongs to project
    const existingExpense = await prisma.projectExpense.findFirst({
      where: {
        id: expenseId,
        projectId,
      },
    })

    if (!existingExpense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    // Don't allow deleting if already billed
    if (existingExpense.billedAt) {
      return NextResponse.json({ error: "Cannot delete expense that has already been billed" }, { status: 400 })
    }

    // Delete expense
    await prisma.projectExpense.delete({
      where: { id: expenseId },
    })

    return NextResponse.json({ message: "Expense deleted successfully" })
  } catch (error: any) {
    console.error("Error deleting expense:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete expense" },
      { status: 500 }
    )
  }
}
