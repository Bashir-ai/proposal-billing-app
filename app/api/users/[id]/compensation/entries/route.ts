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
    const startYear = searchParams.get("startYear") ? parseInt(searchParams.get("startYear")!) : null
    const endYear = searchParams.get("endYear") ? parseInt(searchParams.get("endYear")!) : null
    const startMonth = searchParams.get("startMonth") ? parseInt(searchParams.get("startMonth")!) : null
    const endMonth = searchParams.get("endMonth") ? parseInt(searchParams.get("endMonth")!) : null

    const where: any = { userId }

    if (startYear && endYear) {
      where.periodYear = { gte: startYear, lte: endYear }
      if (startMonth && endMonth) {
        where.AND = [
          {
            OR: [
              { periodYear: { gt: startYear } },
              { periodYear: startYear, periodMonth: { gte: startMonth } },
            ],
          },
          {
            OR: [
              { periodYear: { lt: endYear } },
              { periodYear: endYear, periodMonth: { lte: endMonth } },
            ],
          },
        ]
      }
    }

    const entries = await prisma.compensationEntry.findMany({
      where,
      orderBy: [
        { periodYear: 'desc' },
        { periodMonth: 'desc' },
      ],
      include: {
        compensation: true,
        transactions: {
          orderBy: { transactionDate: 'desc' },
        },
      },
    })

    return NextResponse.json({ entries })
  } catch (error: any) {
    console.error("Error fetching compensation entries:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch compensation entries" },
      { status: 500 }
    )
  }
}
