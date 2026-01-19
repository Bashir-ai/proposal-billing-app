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
    const startDateParam = searchParams.get("startDate")
    const endDateParam = searchParams.get("endDate")

    // Get all clients
    const clients = await prisma.client.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    // Fetch statistics for each client
    const statisticsPromises = clients.map(async (client) => {
      const dateFilter = startDateParam || endDateParam
        ? {
            ...(startDateParam && { gte: new Date(startDateParam) }),
            ...(endDateParam && { lte: new Date(endDateParam) }),
          }
        : undefined

      const projects = await prisma.project.findMany({
        where: {
          clientId: client.id,
          deletedAt: null,
          ...(dateFilter && { createdAt: dateFilter }),
        },
        select: { id: true },
      })
      const projectIds = projects.map(p => p.id)

      const [
        todosTotal,
        todosOngoing,
        todosCompleted,
        totalHours,
        totalRevenue,
        invoicedNotPaid,
      ] = await Promise.all([
        prisma.todo.count({
          where: {
            clientId: client.id,
            ...(dateFilter && { createdAt: dateFilter }),
          },
        }),
        prisma.todo.count({
          where: {
            clientId: client.id,
            status: { in: ["PENDING", "IN_PROGRESS"] },
            ...(dateFilter && { createdAt: dateFilter }),
          },
        }),
        prisma.todo.count({
          where: {
            clientId: client.id,
            status: "COMPLETED",
            ...(dateFilter && { completedAt: dateFilter }),
          },
        }),
        prisma.timesheetEntry.aggregate({
          where: {
            projectId: { in: projectIds },
            ...(dateFilter && { date: dateFilter }),
          },
          _sum: { hours: true },
        }),
        prisma.bill.aggregate({
          where: {
            clientId: client.id,
            status: "PAID",
            ...(dateFilter && { paidAt: dateFilter }),
          },
          _sum: { amount: true },
        }),
        prisma.bill.aggregate({
          where: {
            clientId: client.id,
            status: { in: ["SUBMITTED", "APPROVED"] },
            deletedAt: null,
          },
          _sum: { amount: true },
        }),
      ])

      return {
        clientId: client.id,
        clientName: client.name,
        clientEmail: client.email,
        todosTotal,
        todosOngoing,
        todosCompleted,
        totalHours: totalHours._sum.hours || 0,
        projectsCount: projects.length,
        proposalsCount: await prisma.proposal.count({
          where: {
            clientId: client.id,
            deletedAt: null,
            ...(dateFilter && { createdAt: dateFilter }),
          },
        }),
        invoicesCount: await prisma.bill.count({
          where: {
            clientId: client.id,
            deletedAt: null,
            ...(dateFilter && { createdAt: dateFilter }),
          },
        }),
        totalRevenue: totalRevenue._sum.amount || 0,
        invoicedNotPaid: invoicedNotPaid._sum.amount || 0,
      }
    })

    const statistics = await Promise.all(statisticsPromises)

    return NextResponse.json(statistics)
  } catch (error) {
    console.error("Error fetching clients statistics:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
