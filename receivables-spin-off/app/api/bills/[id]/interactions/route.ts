export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { InteractionType } from "@prisma/client"

const interactionSchema = z.object({
  interactionType: z.nativeEnum(InteractionType),
  notes: z.string().optional(),
  paymentRemarks: z.string().optional(),
  extensionDate: z.string().optional(), // ISO date string
  date: z.string().optional(), // ISO date string
})

const interactionUpdateSchema = z.object({
  interactionType: z.nativeEnum(InteractionType).optional(),
  notes: z.string().optional(),
  paymentRemarks: z.string().optional(),
  extensionDate: z.string().optional(),
  date: z.string().optional(),
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

    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify bill exists
    const bill = await prisma.bill.findUnique({
      where: {
        id,
        deletedAt: null,
      },
    })

    if (!bill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 })
    }

    const interactions = await prisma.invoiceInteraction.findMany({
      where: { billId: id },
      orderBy: { date: "desc" },
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

    return NextResponse.json(interactions)
  } catch (error) {
    console.error("Error fetching invoice interactions:", error)
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

    // Verify bill exists
    const bill = await prisma.bill.findUnique({
      where: {
        id,
        deletedAt: null,
      },
    })

    if (!bill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 })
    }

    // Validate interaction type - only EMAIL_SENT and PHONE_CALL allowed for invoices
    const body = await request.json()
    const validatedData = interactionSchema.parse(body)

    if (validatedData.interactionType !== "EMAIL_SENT" && 
        validatedData.interactionType !== "PHONE_CALL") {
      return NextResponse.json(
        { error: "Only EMAIL_SENT and PHONE_CALL interaction types are allowed for invoices" },
        { status: 400 }
      )
    }

    // Parse date in local timezone to preserve the date as entered
    let interactionDate: Date
    if (validatedData.date) {
      const [year, month, day] = validatedData.date.split('-').map(Number)
      interactionDate = new Date(year, month - 1, day)
    } else {
      interactionDate = new Date()
    }

    // Parse extension date if provided
    let extensionDate: Date | null = null
    if (validatedData.extensionDate) {
      const [year, month, day] = validatedData.extensionDate.split('-').map(Number)
      extensionDate = new Date(year, month - 1, day)
      
      // Validate extension date is in the future
      if (extensionDate <= new Date()) {
        return NextResponse.json(
          { error: "Extension date must be in the future" },
          { status: 400 }
        )
      }
    }

    const interaction = await prisma.invoiceInteraction.create({
      data: {
        billId: id,
        interactionType: validatedData.interactionType,
        notes: validatedData.notes || null,
        paymentRemarks: validatedData.paymentRemarks || null,
        extensionDate: extensionDate,
        date: interactionDate,
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

    return NextResponse.json(interaction, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error creating invoice interaction:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
