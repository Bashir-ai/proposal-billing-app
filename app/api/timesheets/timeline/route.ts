export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const clientId = searchParams.get("clientId")
    const projectId = searchParams.get("projectId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const billed = searchParams.get("billed") // "true", "false", or null for all
    const type = searchParams.get("type") // "timesheet", "charge", or null for both

    // Build where clause for timesheet entries
    const timesheetWhere: any = {}
    const chargeWhere: any = {}

    // User filter - admins can see all, others see only their own
    if (session.user.role === "ADMIN" || session.user.role === "MANAGER") {
      if (userId) {
        timesheetWhere.userId = userId
      }
    } else {
      // Staff users can only see their own entries
      timesheetWhere.userId = session.user.id
    }

    // Client filter (via project)
    if (clientId) {
      timesheetWhere.project = { clientId }
      chargeWhere.project = { clientId }
    }

    // Project filter
    if (projectId) {
      timesheetWhere.projectId = projectId
      chargeWhere.projectId = projectId
    }

    // Date range filter
    if (startDate) {
      timesheetWhere.date = { ...timesheetWhere.date, gte: new Date(startDate) }
      chargeWhere.createdAt = { ...chargeWhere.createdAt, gte: new Date(startDate) }
    }
    if (endDate) {
      timesheetWhere.date = { ...timesheetWhere.date, lte: new Date(endDate) }
      chargeWhere.createdAt = { ...chargeWhere.createdAt, lte: new Date(endDate) }
    }

    // Billed filter
    if (billed === "true") {
      timesheetWhere.billed = true
      chargeWhere.billed = true
    } else if (billed === "false") {
      timesheetWhere.billed = false
      chargeWhere.billed = false
    }

    // Fetch timesheet entries and charges
    const [timesheetEntries, charges] = await Promise.all([
      type !== "charge" ? prisma.timesheetEntry.findMany({
        where: timesheetWhere,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              client: {
                select: {
                  id: true,
                  name: true,
                  company: true,
                },
              },
            },
          },
        },
        orderBy: { date: "asc" },
      }) : Promise.resolve([]),
      type !== "timesheet" ? prisma.projectCharge.findMany({
        where: chargeWhere,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              client: {
                select: {
                  id: true,
                  name: true,
                  company: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }) : Promise.resolve([]),
    ])

    // Transform data for timeline
    const timelineData = {
      timesheetEntries: timesheetEntries.map(entry => ({
        id: entry.id,
        type: "timesheet" as const,
        date: entry.date.toISOString(),
        hours: entry.hours,
        rate: entry.rate,
        description: entry.description,
        billable: entry.billable,
        billed: entry.billed,
        user: entry.user,
        project: entry.project,
        client: entry.project.client,
      })),
      charges: charges.map(charge => ({
        id: charge.id,
        type: "charge" as const,
        date: charge.startDate?.toISOString() || charge.createdAt.toISOString(),
        amount: charge.amount,
        quantity: charge.quantity,
        unitPrice: charge.unitPrice,
        description: charge.description,
        billed: charge.billed,
        chargeType: charge.chargeType,
        project: charge.project,
        client: charge.project.client,
      })),
    }

    return NextResponse.json(timelineData)
  } catch (error) {
    console.error("Error fetching timeline data:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
