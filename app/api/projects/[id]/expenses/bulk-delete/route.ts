export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { isDatabaseConnectionError, getDatabaseErrorMessage } from "@/lib/database-error-handler"

const bulkDeleteSchema = z.object({
  expenseIds: z.array(z.string().min(1)),
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

    // Only ADMIN can bulk delete expenses
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden. Only admins can bulk delete expenses." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { expenseIds } = bulkDeleteSchema.parse(body)

    // Verify all expenses exist and belong to this project
    const expenses = await prisma.projectExpense.findMany({
      where: {
        id: { in: expenseIds },
        projectId: id,
      },
      select: {
        id: true,
      },
    })

    if (expenses.length !== expenseIds.length) {
      return NextResponse.json(
        { error: "Some expenses not found or do not belong to this project" },
        { status: 404 }
      )
    }

    // Delete all expenses in a transaction
    await prisma.$transaction(
      expenseIds.map((expenseId) =>
        prisma.projectExpense.delete({
          where: { id: expenseId },
        })
      )
    )

    return NextResponse.json({
      message: `Successfully deleted ${expenseIds.length} expense(s)`,
      deletedCount: expenseIds.length,
    })
  } catch (error) {
    console.error("Error in bulk delete expenses:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
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

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
