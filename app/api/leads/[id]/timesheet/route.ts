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

    const lead = await prisma.lead.findUnique({
      where: { id },
    })

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    // Check access permissions - only staff/admin can view lead timesheets
    if (session.user.role === "CLIENT" || session.user.role === "EXTERNAL") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const includeArchived = searchParams.get("archived") === "true"

    const where: any = { leadId: id }
    if (!includeArchived) {
      where.archivedAt = null
    }

    const entries = await prisma.timesheetEntry.findMany({
      where,
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

    if (session.user.role === "CLIENT" || session.user.role === "EXTERNAL") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const lead = await prisma.lead.findUnique({
      where: { id },
    })

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = timesheetEntrySchema.parse(body)

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

    // Determine rate: use provided rate, or user's default rate
    let rateToUse: number | null = null
    
    if (validatedData.rate !== null && validatedData.rate !== undefined) {
      // Use explicitly provided rate
      rateToUse = validatedData.rate
    } else {
      // Use user's default hourly rate
      rateToUse = user.defaultHourlyRate
    }

    const entry = await prisma.timesheetEntry.create({
      data: {
        leadId: id,
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
