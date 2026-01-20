export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { parseLocalDate } from "@/lib/utils"
import { getCurrentUserTimezone } from "@/lib/timezone-utils"

const timesheetEntrySchema = z.object({
  userId: z.string(),
  date: z.string(),
  hours: z.number().min(0),
  rate: z.number().min(0).optional().nullable(),
  description: z.string().optional().or(z.literal("")).nullable(),
  billable: z.boolean().default(true),
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

    // For EXTERNAL users, only allow access to assigned projects
    if (session.user.role === "EXTERNAL") {
      const isAssigned = await prisma.projectManager.findFirst({
        where: {
          projectId: id,
          userId: session.user.id,
        },
      })
      if (!isAssigned) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const entries = await prisma.timesheetEntry.findMany({
      where: { projectId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { date: "desc" },
    })

    return NextResponse.json(entries)
  } catch (error) {
    console.error("Error fetching timesheet entries:", error)
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

    // For EXTERNAL users, only allow creating entries for assigned projects
    if (session.user.role === "EXTERNAL") {
      const isAssigned = await prisma.projectManager.findFirst({
        where: {
          projectId: id,
          userId: session.user.id,
        },
      })
      if (!isAssigned) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const body = await request.json()
    const validatedData = timesheetEntrySchema.parse(body)

    // For EXTERNAL users, they can only create entries for themselves
    if (session.user.role === "EXTERNAL" && validatedData.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden - External users can only create entries for themselves" },
        { status: 403 }
      )
    }

    // Verify user exists and get default rate
    const user = await prisma.user.findUnique({
      where: { id: validatedData.userId },
      select: {
        id: true,
        defaultHourlyRate: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Use provided rate or user's default rate, or null if neither available
    const rateToUse = validatedData.rate ?? user.defaultHourlyRate ?? null

    const entry = await prisma.timesheetEntry.create({
      data: {
        projectId: id,
        userId: validatedData.userId,
        date: parseLocalDate(validatedData.date, await getCurrentUserTimezone()),
        hours: validatedData.hours,
        rate: rateToUse,
        description: validatedData.description || null,
        billable: validatedData.billable,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(entry, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error creating timesheet entry:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}

