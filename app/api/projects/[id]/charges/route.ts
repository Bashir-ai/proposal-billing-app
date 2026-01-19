export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ChargeType, RecurringFrequency } from "@prisma/client"
import { isDatabaseConnectionError, getDatabaseErrorMessage } from "@/lib/database-error-handler"
import { parseLocalDate } from "@/lib/utils"

const chargeSchema = z.object({
  description: z.string().min(1),
  amount: z.number().min(0),
  quantity: z.number().min(0).optional(),
  unitPrice: z.number().min(0).optional(),
  chargeType: z.nativeEnum(ChargeType).default(ChargeType.ONE_TIME),
  recurringFrequency: z.nativeEnum(RecurringFrequency).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
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

    const charges = await prisma.projectCharge.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(charges)
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
    console.error("Error fetching charges:", error)
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
    const validatedData = chargeSchema.parse(body)

    const charge = await prisma.projectCharge.create({
      data: {
        projectId: id,
        description: validatedData.description,
        amount: validatedData.amount,
        quantity: validatedData.quantity ?? 1,
        unitPrice: validatedData.unitPrice ?? null,
        chargeType: validatedData.chargeType,
        recurringFrequency: validatedData.recurringFrequency ?? null,
        startDate: validatedData.startDate ? parseLocalDate(validatedData.startDate) : null,
        endDate: validatedData.endDate ? parseLocalDate(validatedData.endDate) : null,
      },
    })

    return NextResponse.json(charge, { status: 201 })
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

    console.error("Error creating charge:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}
