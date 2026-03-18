export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

    // Get client to verify access
    const client = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
      },
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    // Check if client can access their own data
    if (session.user.role === "CLIENT") {
      const clientUser = await prisma.client.findFirst({
        where: { 
          email: session.user.email,
          deletedAt: null,
        },
      })
      if (!clientUser || client.id !== clientUser.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Get all projects for this client
    const projects = await prisma.project.findMany({
      where: {
        clientId: id,
      },
      select: {
        id: true,
        name: true,
      },
    })

    const projectIds = projects.map(p => p.id)

    if (projectIds.length === 0) {
      return NextResponse.json({
        timesheetEntries: [],
        charges: [],
        totals: {
          timesheets: 0,
          charges: 0,
          total: 0,
        },
      })
    }

    // Fetch unbilled timesheet entries from all projects
    const unbilledTimesheets = await prisma.timesheetEntry.findMany({
      where: {
        projectId: { in: projectIds },
        billed: false,
        billable: true,
      },
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
          },
        },
      },
      orderBy: { date: "asc" },
    })

    // Fetch unbilled charges from all projects
    const unbilledCharges = await prisma.projectCharge.findMany({
      where: {
        projectId: { in: projectIds },
        billed: false,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    // Calculate totals
    const timesheetTotal = unbilledTimesheets.reduce((sum, entry) => {
      const amount = (entry.rate || 0) * entry.hours
      return sum + amount
    }, 0)

    const chargesTotal = unbilledCharges.reduce((sum, charge) => {
      return sum + charge.amount
    }, 0)

    return NextResponse.json({
      timesheetEntries: unbilledTimesheets.map(entry => ({
        id: entry.id,
        date: entry.date,
        hours: entry.hours,
        rate: entry.rate,
        amount: (entry.rate || 0) * entry.hours,
        description: entry.description,
        user: entry.user,
        project: entry.project,
      })),
      charges: unbilledCharges.map(charge => ({
        ...charge,
        project: charge.project,
      })),
      totals: {
        timesheets: timesheetTotal,
        charges: chargesTotal,
        total: timesheetTotal + chargesTotal,
      },
    })
  } catch (error: any) {
    console.error("Error fetching unbilled items:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}



