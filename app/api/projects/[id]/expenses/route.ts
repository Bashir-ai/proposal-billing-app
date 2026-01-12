export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { UserRole } from "@prisma/client"

const expenseSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("EUR"),
  expenseDate: z.string().transform((str) => new Date(str)),
  category: z.string().nullable().optional(),
  receiptPath: z.string().nullable().optional(),
  isBillable: z.boolean().default(false),
  isReimbursement: z.boolean().default(false),
  projectId: z.string().nullable().optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const projectId = id

    // Verify project exists and user has access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, clientId: true },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Check permissions: staff can view, clients can view their own projects
    if (session.user.role === UserRole.CLIENT) {
      // Clients can only view their own projects
      const client = await prisma.client.findUnique({
        where: { id: project.clientId },
      })
      // TODO: Check if client matches user (would need client-user relation)
    }

    const expenses = await prisma.projectExpense.findMany({
      where: { projectId },
      orderBy: { expenseDate: 'desc' },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        bill: {
          select: { id: true, invoiceNumber: true, amount: true },
        },
      },
    })

    return NextResponse.json({ expenses })
  } catch (error: any) {
    console.error("Error fetching expenses:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch expenses" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only staff can create expenses
    if (session.user.role === UserRole.CLIENT) {
      return NextResponse.json({ error: "Forbidden - Staff access required" }, { status: 403 })
    }

    const { id } = await params
    const projectId = id
    const body = await request.json()
    const validatedData = expenseSchema.parse(body)

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Create expense
    const expense = await prisma.projectExpense.create({
      data: {
        projectId: validatedData.projectId || projectId,
        description: validatedData.description,
        amount: validatedData.amount,
        currency: validatedData.currency,
        expenseDate: validatedData.expenseDate,
        category: validatedData.category ?? null,
        receiptPath: validatedData.receiptPath ?? null,
        isBillable: validatedData.isBillable,
        isReimbursement: validatedData.isReimbursement,
        createdBy: session.user.id,
      },
    })

    return NextResponse.json({ expense }, { status: 201 })
  } catch (error: any) {
    console.error("Error creating expense:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }
    return NextResponse.json(
      { error: error.message || "Failed to create expense" },
      { status: 500 }
    )
  }
}
