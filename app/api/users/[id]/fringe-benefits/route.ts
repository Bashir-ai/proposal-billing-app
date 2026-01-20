export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { UserRole, FringeBenefitCategory, AdvanceType } from "@prisma/client"

const benefitSchema = z.object({
  type: z.enum(["ONE_OFF", "RECURRING"]).optional().default("ONE_OFF"),
  description: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("EUR"),
  benefitDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)).optional().nullable(),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]).optional().nullable(),
  category: z.enum(["HEALTH", "TRANSPORT", "MEAL", "OTHER"]),
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
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const category = searchParams.get("category")

    const where: any = { userId }

    if (startDate) {
      where.benefitDate = { ...where.benefitDate, gte: new Date(startDate) }
    }
    if (endDate) {
      where.benefitDate = { ...where.benefitDate, lte: new Date(endDate) }
    }
    if (category) {
      where.category = category as FringeBenefitCategory
    }

    const benefits = await prisma.fringeBenefit.findMany({
      where,
      orderBy: { benefitDate: 'desc' },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json({ benefits })
  } catch (error: any) {
    console.error("Error fetching fringe benefits:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch fringe benefits" },
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

    // Only admins and managers can create benefits
    if (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.MANAGER) {
      return NextResponse.json({ error: "Forbidden - Admin or Manager access required" }, { status: 403 })
    }

    const { id } = await params
    const userId = id
    const body = await request.json()
    const validatedData = benefitSchema.parse(body)

    // Validate based on type
    const benefitType = validatedData.type || "ONE_OFF"
    if (benefitType === "RECURRING") {
      if (!validatedData.frequency) {
        return NextResponse.json({ error: "Frequency is required for recurring benefits" }, { status: 400 })
      }
      if (!validatedData.endDate) {
        return NextResponse.json({ error: "End date is required for recurring benefits" }, { status: 400 })
      }
    }

    // Create benefit
    const benefit = await prisma.fringeBenefit.create({
      data: {
        userId,
        type: benefitType as AdvanceType,
        description: validatedData.description,
        amount: validatedData.amount,
        currency: validatedData.currency,
        benefitDate: validatedData.benefitDate,
        endDate: validatedData.endDate || null,
        frequency: validatedData.frequency || null,
        category: validatedData.category as FringeBenefitCategory,
        createdBy: session.user.id,
      },
    })

    return NextResponse.json({ benefit }, { status: 201 })
  } catch (error: any) {
    console.error("Error creating fringe benefit:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }
    return NextResponse.json(
      { error: error.message || "Failed to create fringe benefit" },
      { status: 500 }
    )
  }
}
