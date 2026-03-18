export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientUnbilledSummary } from "@/lib/finder-helpers"

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

    // EXTERNAL users can only view their own finder clients
    if (session.user.role === "EXTERNAL" && session.user.id !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Only EXTERNAL users and admins can access this endpoint
    if (session.user.role !== "EXTERNAL" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get all clients where this user is a finder
    const clientFinders = await prisma.clientFinder.findMany({
      where: {
        userId: id,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            company: true,
            deletedAt: true,
          },
        },
      },
    })

    // Filter out deleted clients and build response
    const clientsData = await Promise.all(
      clientFinders
        .filter((cf) => !cf.client.deletedAt)
        .map(async (cf) => {
          const clientId = cf.client.id

          // Get active projects for this client
          const projects = await prisma.project.findMany({
            where: {
              clientId,
              status: "ACTIVE",
              deletedAt: null,
            },
            select: {
              id: true,
              name: true,
              status: true,
            },
          })

          // Calculate unbilled hours for each project
          const projectsWithUnbilled = await Promise.all(
            projects.map(async (project) => {
              // Get unbilled timesheet entries
              const unbilledTimesheets = await prisma.timesheetEntry.findMany({
                where: {
                  projectId: project.id,
                  billed: false,
                  billable: true,
                },
                select: {
                  hours: true,
                  rate: true,
                },
              })

              // Get unbilled charges
              const unbilledCharges = await prisma.projectCharge.findMany({
                where: {
                  projectId: project.id,
                  billed: false,
                },
                select: {
                  amount: true,
                },
              })

              const hours = unbilledTimesheets.reduce((sum, entry) => sum + entry.hours, 0)
              const amount =
                unbilledTimesheets.reduce((sum, entry) => sum + (entry.rate || 0) * entry.hours, 0) +
                unbilledCharges.reduce((sum, charge) => sum + charge.amount, 0)

              return {
                id: project.id,
                name: project.name,
                status: project.status,
                unbilledHours: hours,
                unbilledAmount: amount,
              }
            })
          )

          // Get all invoices for this client
          const invoices = await prisma.bill.findMany({
            where: {
              clientId,
              deletedAt: null,
            },
            select: {
              id: true,
              invoiceNumber: true,
              amount: true,
              status: true,
              createdAt: true,
              paidAt: true,
              dueDate: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          })

          // Calculate summary statistics
          const totalUnbilledHours = projectsWithUnbilled.reduce((sum, p) => sum + p.unbilledHours, 0)
          const totalUnbilledAmount = projectsWithUnbilled.reduce((sum, p) => sum + p.unbilledAmount, 0)
          const openProjectsCount = projectsWithUnbilled.length
          const invoicesSent = invoices.filter((inv) => inv.status !== "DRAFT").length
          const invoicesPaid = invoices.filter((inv) => inv.status === "PAID").length
          const invoicesOutstanding = invoices.filter(
            (inv) => inv.status !== "PAID" && inv.status !== "CANCELLED" && inv.status !== "WRITTEN_OFF"
          ).length

          return {
            id: clientId,
            name: cf.client.name,
            company: cf.client.company,
            finderFeePercent: cf.finderFeePercent,
            projects: projectsWithUnbilled,
            invoices: invoices.map((inv) => ({
              id: inv.id,
              invoiceNumber: inv.invoiceNumber,
              amount: inv.amount,
              status: inv.status,
              sentAt: inv.createdAt.toISOString(),
              paidAt: inv.paidAt?.toISOString() || null,
              dueDate: inv.dueDate?.toISOString() || null,
            })),
            summary: {
              totalUnbilledHours,
              totalUnbilledAmount,
              openProjectsCount,
              invoicesSent,
              invoicesPaid,
              invoicesOutstanding,
            },
          }
        })
    )

    return NextResponse.json({ clients: clientsData })
  } catch (error: any) {
    console.error("Error fetching finder clients:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}
