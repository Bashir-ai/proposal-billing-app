export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { z } from "zod"

const billExpenseSchema = z.object({
  billId: z.string(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only staff can mark expenses as billed
    if (session.user.role === UserRole.CLIENT) {
      return NextResponse.json({ error: "Forbidden - Staff access required" }, { status: 403 })
    }

    const { id, expenseId } = await params
    const projectId = id
    const body = await request.json()
    const validatedData = billExpenseSchema.parse(body)

    // Verify expense belongs to project
    const expense = await prisma.projectExpense.findFirst({
      where: {
        id: expenseId,
        projectId,
      },
    })

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    // Verify bill exists
    const bill = await prisma.bill.findUnique({
      where: { id: validatedData.billId },
    })

    if (!bill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 })
    }

    // Update expense to mark as billed
    const updatedExpense = await prisma.projectExpense.update({
      where: { id: expenseId },
      data: {
        billedAt: new Date(),
        billId: validatedData.billId,
      },
    })

    return NextResponse.json({ expense: updatedExpense })
  } catch (error: any) {
    console.error("Error marking expense as billed:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }
    return NextResponse.json(
      { error: error.message || "Failed to mark expense as billed" },
      { status: 500 }
    )
  }
}
