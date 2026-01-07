export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ChargeType, RecurringFrequency } from "@prisma/client"

const projectChargeSchema = z.object({
  description: z.string().min(1),
  amount: z.number().min(0).optional(),
  quantity: z.number().min(0).optional(),
  unitPrice: z.number().min(0).optional(),
  chargeType: z.nativeEnum(ChargeType).default(ChargeType.ONE_TIME),
  recurringFrequency: z.nativeEnum(RecurringFrequency).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
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

    // Check access permissions
    if (session.user.role === "CLIENT") {
      const client = await prisma.client.findFirst({
        where: { 
          email: session.user.email,
          deletedAt: null, // Exclude deleted clients
        },
      })
      if (!client || project.clientId !== client.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const charges = await prisma.projectCharge.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(charges)
  } catch (error) {
    console.error("Error fetching project charges:", error)
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

    const project = await prisma.project.findUnique({
      where: { id },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = projectChargeSchema.parse(body)

    // Calculate amount if quantity and unitPrice provided
    let amount = validatedData.amount
    if (!amount && validatedData.quantity && validatedData.unitPrice) {
      amount = validatedData.quantity * validatedData.unitPrice
    }
    if (!amount) {
      return NextResponse.json(
        { error: "Amount is required (either directly or via quantity × unitPrice)" },
        { status: 400 }
      )
    }

    // Validate recurring charge requirements
    if (validatedData.chargeType === ChargeType.RECURRING) {
      if (!validatedData.recurringFrequency) {
        return NextResponse.json(
          { error: "Recurring frequency is required for recurring charges" },
          { status: 400 }
        )
      }
      if (!validatedData.startDate) {
        return NextResponse.json(
          { error: "Start date is required for recurring charges" },
          { status: 400 }
        )
      }
    }

    const charge = await prisma.projectCharge.create({
      data: {
        projectId: id,
        description: validatedData.description,
        amount,
        quantity: validatedData.quantity || 1,
        unitPrice: validatedData.unitPrice || amount,
        chargeType: validatedData.chargeType,
        recurringFrequency: validatedData.recurringFrequency || null,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : null,
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
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

    console.error("Error creating project charge:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}



