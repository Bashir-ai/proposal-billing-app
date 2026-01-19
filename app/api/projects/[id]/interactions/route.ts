export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { parseLocalDate } from "@/lib/utils"

const interactionSchema = z.object({
  interactionType: z.string().min(1), // "STATUS_UPDATE", "MILESTONE_REACHED", "NOTE", "MEETING", "PHONE_CALL", "EMAIL", etc.
  title: z.string().optional(),
  notes: z.string().optional(),
  date: z.string().optional(), // ISO date string (YYYY-MM-DD)
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

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        projectManagers: {
          select: {
            userId: true,
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Check if user is assigned to this project (project manager, admin, or manager)
    const isAssigned = 
      project.projectManagers.some(pm => pm.userId === session.user.id) ||
      session.user.role === "ADMIN" ||
      session.user.role === "MANAGER"

    // Build where clause: show all interactions except INTERNAL_COMMENT if not assigned
    // But always show INTERNAL_COMMENT if the user created it
    const whereClause: any = { projectId: id }
    if (!isAssigned) {
      whereClause.OR = [
        { interactionType: { not: "INTERNAL_COMMENT" } },
        { 
          interactionType: "INTERNAL_COMMENT",
          createdBy: session.user.id
        }
      ]
    }

    const interactions = await prisma.projectInteraction.findMany({
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
    console.error("Error fetching project interactions:", error)
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

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: {
        id,
        deletedAt: null,
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = interactionSchema.parse(body)

    // Parse date in local timezone to preserve the date as entered
    let interactionDate: Date
    if (validatedData.date) {
      interactionDate = parseLocalDate(validatedData.date)
    } else {
      interactionDate = new Date()
    }

    const interaction = await prisma.projectInteraction.create({
      data: {
        projectId: id,
        interactionType: validatedData.interactionType,
        title: validatedData.title || null,
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

    console.error("Error creating project interaction:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
