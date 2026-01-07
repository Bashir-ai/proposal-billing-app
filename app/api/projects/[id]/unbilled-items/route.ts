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

    // Get project to verify access
    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Check if client can access this project
    if (session.user.role === "CLIENT") {
      const client = await prisma.client.findFirst({
        where: { 
          email: session.user.email,
          deletedAt: null,
        },
      })
      if (!client || project.clientId !== client.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Fetch unbilled timesheet entries
    const unbilledTimesheets = await prisma.timesheetEntry.findMany({
      where: {
        projectId: id,
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
      },
      orderBy: { date: "asc" },
    })

    // Fetch unbilled charges
    const unbilledCharges = await prisma.projectCharge.findMany({
      where: {
        projectId: id,
        billed: false,
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
      })),
      charges: unbilledCharges,
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


