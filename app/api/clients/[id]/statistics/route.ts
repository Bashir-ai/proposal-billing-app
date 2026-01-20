export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateTotalUnbilledWork } from "@/lib/financial-calculations"

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

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: {
        id,
        deletedAt: null,
      },
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get("startDate")
    const endDateParam = searchParams.get("endDate")

    const dateFilter = startDateParam || endDateParam
      ? {
          ...(startDateParam && { gte: new Date(startDateParam) }),
          ...(endDateParam && { lte: new Date(endDateParam) }),
        }
      : undefined

    // Get client's projects
    const projects = await prisma.project.findMany({
      where: {
        clientId: id,
        deletedAt: null,
        ...(dateFilter && { createdAt: dateFilter }),
      },
      select: { id: true },
    })
    const projectIds = projects.map(p => p.id)

    // Calculate statistics
    const [
      todosTotal,
      todosOngoing,
      todosCompleted,
      totalHours,
      projectsCount,
      proposalsCount,
      invoicesCount,
      totalRevenue,
      invoicedNotPaid,
      unbilledWork,
      closedProposalsNotCharged,
    ] = await Promise.all([
      // Todos
      prisma.todo.count({
        where: {
          clientId: id,
          ...(dateFilter && { createdAt: dateFilter }),
        },
      }),
      prisma.todo.count({
        where: {
          clientId: id,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          ...(dateFilter && { createdAt: dateFilter }),
        },
      }),
      prisma.todo.count({
        where: {
          clientId: id,
          status: "COMPLETED",
          ...(dateFilter && { completedAt: dateFilter }),
        },
      }),
      // Total hours from timesheet entries
      prisma.timesheetEntry.aggregate({
        where: {
          projectId: { in: projectIds },
          ...(dateFilter && { date: dateFilter }),
        },
        _sum: {
          hours: true,
        },
      }),
      // Projects count (already have this from projects array)
      Promise.resolve(projects.length),
      // Proposals
      prisma.proposal.count({
        where: {
          clientId: id,
          deletedAt: null,
          ...(dateFilter && { createdAt: dateFilter }),
        },
      }),
      // Invoices
      prisma.bill.count({
        where: {
          clientId: id,
          deletedAt: null,
          ...(dateFilter && { createdAt: dateFilter }),
        },
      }),
      // Total revenue (paid invoices)
      prisma.bill.aggregate({
        where: {
          clientId: id,
          status: "PAID",
          ...(dateFilter && { paidAt: dateFilter }),
        },
        _sum: {
          amount: true,
        },
      }),
      // Invoiced but not paid
      prisma.bill.aggregate({
        where: {
          clientId: id,
          status: { in: ["SUBMITTED", "APPROVED"] },
          deletedAt: null,
        },
        _sum: {
          amount: true,
        },
      }),
      // Unbilled work (for this client's projects)
      projectIds.length > 0
        ? (async () => {
            const tsAgg = await prisma.timesheetEntry.aggregate({
              where: {
                projectId: { in: projectIds },
                billed: false,
                billable: true,
              },
              _sum: { hours: true },
            })
            const tsEntries = await prisma.timesheetEntry.findMany({
              where: {
                projectId: { in: projectIds },
                billed: false,
                billable: true,
              },
              select: { hours: true, rate: true },
              take: 10000,
            })
            const tsAmount = tsEntries.reduce((sum, e) => sum + (e.hours * (e.rate || 0)), 0)
            const chargeAgg = await prisma.projectCharge.aggregate({
              where: {
                projectId: { in: projectIds },
                billed: false,
              },
              _sum: { amount: true },
            })
            const chargesAmount = chargeAgg._sum.amount || 0
            return {
              timesheetHours: tsAgg._sum.hours || 0,
              timesheetAmount: tsAmount,
              chargesAmount,
              totalAmount: tsAmount + chargesAmount,
            }
          })()
        : Promise.resolve({ timesheetHours: 0, timesheetAmount: 0, chargesAmount: 0, totalAmount: 0 }),
      // Closed proposals not charged (filtered by clientId)
      (async () => {
        const approvedProposals = await prisma.proposal.findMany({
          where: {
            clientId: id,
            status: "APPROVED",
            clientApprovalStatus: "APPROVED",
            deletedAt: null,
          },
          select: {
            id: true,
            amount: true,
            projects: {
              select: { id: true },
            },
          },
        })

        if (approvedProposals.length === 0) return 0

        const projectIds = approvedProposals.flatMap(p => p.projects.map(proj => proj.id))
        let projectTotalMap = new Map<string, number>()
        
        if (projectIds.length > 0) {
          const projectTotals = await prisma.bill.groupBy({
            by: ['projectId'],
            where: {
              projectId: { in: projectIds },
              status: { in: ["SUBMITTED", "APPROVED", "PAID"] },
              deletedAt: null,
            },
            _sum: { amount: true },
          })
          projectTotalMap = new Map(
            projectTotals.map(pt => [pt.projectId || '', pt._sum.amount || 0])
          )
        }

        let totalNotCharged = 0
        for (const proposal of approvedProposals) {
          const proposalAmount = proposal.amount || 0
          if (proposal.projects.length === 0) {
            totalNotCharged += proposalAmount
          } else {
            let totalInvoiced = 0
            for (const project of proposal.projects) {
              totalInvoiced += projectTotalMap.get(project.id) || 0
            }
            if (totalInvoiced < proposalAmount) {
              totalNotCharged += proposalAmount - totalInvoiced
            }
          }
        }
        return totalNotCharged
      })(),
    ])

    const statistics = {
      clientId: id,
      clientName: client.name,
      clientEmail: client.email,
      todosTotal,
      todosOngoing,
      todosCompleted,
      totalHours: totalHours._sum.hours || 0,
      projectsCount,
      proposalsCount,
      invoicesCount,
      totalRevenue: totalRevenue._sum.amount || 0,
      invoicedNotPaid: invoicedNotPaid._sum.amount || 0,
      unbilledWork: {
        timesheetHours: unbilledWork.timesheetHours,
        totalAmount: unbilledWork.totalAmount,
      },
      closedProposalsNotCharged,
    }

    return NextResponse.json(statistics)
  } catch (error) {
    console.error("Error fetching client statistics:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
