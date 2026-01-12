export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const userId = id

    // Check permissions: user can view own, admin/manager can view all
    if (session.user.id !== userId && session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.MANAGER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const includeCompensation = searchParams.get("includeCompensation") !== "false"
    const includeAdvances = searchParams.get("includeAdvances") !== "false"
    const includeBenefits = searchParams.get("includeBenefits") !== "false"

    const dateFilter: any = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate)
    }

    // Get current balance from latest compensation entry
    const latestEntry = await prisma.compensationEntry.findFirst({
      where: { userId },
      orderBy: [
        { periodYear: 'desc' },
        { periodMonth: 'desc' },
      ],
    })

    // Calculate total balance from transactions
    const transactions = await prisma.userFinancialTransaction.findMany({
      where: {
        userId,
        ...(startDate || endDate ? { transactionDate: dateFilter } : {}),
      },
    })

    const totalBalance = transactions.reduce((sum, t) => sum + t.amount, 0)

    // Get YTD earnings
    const currentYear = new Date().getFullYear()
    const ytdEntries = await prisma.compensationEntry.findMany({
      where: {
        userId,
        periodYear: currentYear,
      },
    })
    const ytdEarnings = ytdEntries.reduce((sum, e) => sum + e.totalEarned, 0)

    // Get monthly earnings for selected period
    let monthlyEarnings = 0
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const periodEntries = await prisma.compensationEntry.findMany({
        where: {
          userId,
          periodYear: { gte: start.getFullYear(), lte: end.getFullYear() },
        },
      })
      monthlyEarnings = periodEntries
        .filter(e => {
          const entryDate = new Date(e.periodYear, e.periodMonth - 1, 1)
          return entryDate >= start && entryDate <= end
        })
        .reduce((sum, e) => sum + e.totalEarned, 0)
    }

    // Get total outstanding advances
    const activeAdvances = await prisma.officeAdvance.findMany({
      where: {
        userId,
        isActive: true,
      },
    })

    const advanceTransactions = await prisma.userFinancialTransaction.findMany({
      where: {
        userId,
        type: "ADVANCE",
        relatedId: { in: activeAdvances.map(a => a.id) },
        ...(startDate || endDate ? { transactionDate: dateFilter } : {}),
      },
    })

    const totalAdvances = advanceTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0)

    // Get total benefits for current year
    const currentYearStart = new Date(currentYear, 0, 1)
    const currentYearEnd = new Date(currentYear, 11, 31)
    const benefits = await prisma.fringeBenefit.findMany({
      where: {
        userId,
        benefitDate: {
          gte: currentYearStart,
          lte: currentYearEnd,
        },
      },
    })
    const totalBenefits = benefits.reduce((sum, b) => sum + b.amount, 0)

    // Get compensation data if requested
    let compensation = null
    if (includeCompensation) {
      compensation = await prisma.userCompensation.findFirst({
        where: {
          userId,
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: new Date() } },
          ],
        },
        orderBy: { effectiveFrom: 'desc' },
      })
    }

    // Get advances if requested
    let advances: any[] = []
    if (includeAdvances) {
      const advancesList = await prisma.officeAdvance.findMany({
        where: {
          userId,
          ...(startDate || endDate ? {
            startDate: dateFilter,
          } : {}),
        },
        orderBy: { createdAt: 'desc' },
      })

      // Fetch transactions for each advance
      advances = await Promise.all(
        advancesList.map(async (advance) => {
          const transactions = await prisma.userFinancialTransaction.findMany({
            where: {
              relatedId: advance.id,
              relatedType: "ADVANCE",
            },
            orderBy: { transactionDate: 'desc' },
          })
          return {
            ...advance,
            transactions,
          }
        })
      )
    }

    // Get benefits if requested
    let benefitsList: any[] = []
    if (includeBenefits) {
      benefitsList = await prisma.fringeBenefit.findMany({
        where: {
          userId,
          ...(startDate || endDate ? { benefitDate: dateFilter } : {}),
        },
        orderBy: { benefitDate: 'desc' },
      })
    }

    return NextResponse.json({
      balance: totalBalance,
      ytdEarnings,
      monthlyEarnings,
      totalAdvances,
      totalBenefits,
      compensation,
      advances,
      benefits: benefitsList,
    })
  } catch (error: any) {
    console.error("Error fetching accounts summary:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch accounts summary" },
      { status: 500 }
    )
  }
}
