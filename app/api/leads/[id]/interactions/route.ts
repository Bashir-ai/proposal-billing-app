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
  date: z.string().optional(), // ISO date string
})

const interactionUpdateSchema = z.object({
  interactionType: z.nativeEnum(InteractionType).optional(),
  notes: z.string().optional(),
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

    // Verify lead exists
    const lead = await prisma.lead.findUnique({
      where: {
        id,
        deletedAt: null,
      },
    })

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    // Check if user is assigned to this lead (lead manager, creator, admin, or manager)
    const isAssigned = 
      lead.leadManagerId === session.user.id || 
      lead.createdBy === session.user.id ||
      session.user.role === "ADMIN" ||
      session.user.role === "MANAGER"

    // Build where clause: show all interactions except INTERNAL_COMMENT if not assigned
    // But always show INTERNAL_COMMENT if the user created it
    const whereClause: any = { leadId: id }
    if (!isAssigned) {
      whereClause.OR = [
        { interactionType: { not: "INTERNAL_COMMENT" } },
        { 
          interactionType: "INTERNAL_COMMENT",
          createdBy: session.user.id
        }
      ]
    }

    const interactions = await prisma.leadInteraction.findMany({
      where: whereClause,
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
    console.error("Error fetching lead interactions:", error)
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

    // Verify lead exists
    const lead = await prisma.lead.findUnique({
      where: {
        id,
        deletedAt: null,
      },
    })

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = interactionSchema.parse(body)

    // Parse date in local timezone to preserve the date as entered
    // This prevents timezone conversion issues (e.g., date showing as day before)
    let interactionDate: Date
    if (validatedData.date) {
      const [year, month, day] = validatedData.date.split('-').map(Number)
      interactionDate = new Date(year, month - 1, day)
    } else {
      interactionDate = new Date()
    }

    const interaction = await prisma.leadInteraction.create({
      data: {
        leadId: id,
        interactionType: validatedData.interactionType,
        notes: validatedData.notes || null,
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

    console.error("Error creating lead interaction:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}




