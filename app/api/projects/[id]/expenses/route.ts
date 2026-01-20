export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { isDatabaseConnectionError, getDatabaseErrorMessage } from "@/lib/database-error-handler"
import { parseLocalDate } from "@/lib/utils"

const expenseSchema = z.object({
  description: z.string().min(1),
  amount: z.number().min(0),
  currency: z.string().optional().default("EUR"),
  expenseDate: z.string(),
  category: z.string().optional(),
  isBillable: z.boolean().optional().default(false),
  isReimbursement: z.boolean().optional().default(false),
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

    const project = await prisma.project.findUnique({
      where: { id },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const expenses = await prisma.projectExpense.findMany({
      where: { projectId: id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { expenseDate: "desc" },
    })

    return NextResponse.json(expenses)
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        {
          error: "Database connection error",
          message: getDatabaseErrorMessage()
        },
        { status: 503 }
      )
    }
    console.error("Error fetching expenses:", error)
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

    if (session.user.role === "CLIENT" || session.user.role === "EXTERNAL") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const project = await prisma.project.findUnique({
      where: { id },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = expenseSchema.parse(body)

    const expense = await prisma.projectExpense.create({
      data: {
        projectId: id,
        description: validatedData.description,
        amount: validatedData.amount,
        currency: validatedData.currency,
        expenseDate: parseLocalDate(validatedData.expenseDate),
        category: validatedData.category || null,
        isBillable: validatedData.isBillable,
        isReimbursement: validatedData.isReimbursement,
        createdBy: session.user.id,
      },
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

    return NextResponse.json(expense, { status: 201 })
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

    console.error("Error creating expense:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}
