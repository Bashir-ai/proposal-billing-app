export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { UserRole, AdvanceType, AdvanceFrequency } from "@prisma/client"

const advanceSchema = z.object({
  type: z.enum(["RECURRING", "ONE_OFF"]),
  description: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("EUR"),
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)).nullable().optional(),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]).nullable().optional(),
  isActive: z.boolean().default(true),
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
    const userId = id

    // Check permissions: user can view own, admin/manager can view all
    if (session.user.id !== userId && session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.MANAGER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get("activeOnly") === "true"

    const where: any = { userId }
    if (activeOnly) {
      where.isActive = true
    }

    const advances = await prisma.officeAdvance.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        transactions: {
          orderBy: { transactionDate: 'desc' },
        },
      },
    })

    return NextResponse.json({ advances })
  } catch (error: any) {
    console.error("Error fetching advances:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch advances" },
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

    // Only admins and managers can create advances
    if (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.MANAGER) {
      return NextResponse.json({ error: "Forbidden - Admin or Manager access required" }, { status: 403 })
    }

    const { id } = await params
    const userId = id
    const body = await request.json()
    const validatedData = advanceSchema.parse(body)

    // Validate based on type
    if (validatedData.type === "RECURRING") {
      if (!validatedData.frequency) {
        return NextResponse.json({ error: "Frequency is required for recurring advances" }, { status: 400 })
      }
      if (!validatedData.endDate) {
        return NextResponse.json({ error: "End date is required for recurring advances" }, { status: 400 })
      }
    }

    // Create advance
    const advance = await prisma.officeAdvance.create({
      data: {
        userId,
        type: validatedData.type as AdvanceType,
        description: validatedData.description,
        amount: validatedData.amount,
        currency: validatedData.currency,
        startDate: validatedData.startDate,
        endDate: validatedData.endDate ?? null,
        frequency: validatedData.frequency as AdvanceFrequency | null,
        isActive: validatedData.isActive,
        createdBy: session.user.id,
      },
    })

    // Create transaction for one-off advances
    if (validatedData.type === "ONE_OFF") {
      await prisma.userFinancialTransaction.create({
        data: {
          userId,
          type: "ADVANCE",
          relatedId: advance.id,
          relatedType: "ADVANCE",
          amount: -validatedData.amount, // Negative because it's a credit against the user
          currency: validatedData.currency,
          transactionDate: validatedData.startDate,
          description: validatedData.description,
          createdBy: session.user.id,
        },
      })
    }

    return NextResponse.json({ advance }, { status: 201 })
  } catch (error: any) {
    console.error("Error creating advance:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }
    return NextResponse.json(
      { error: error.message || "Failed to create advance" },
      { status: 500 }
    )
  }
}
