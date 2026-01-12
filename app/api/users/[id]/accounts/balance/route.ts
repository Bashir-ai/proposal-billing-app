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

    // Calculate current balance from all transactions
    const transactions = await prisma.userFinancialTransaction.findMany({
      where: { userId },
    })

    const balance = transactions.reduce((sum, t) => sum + t.amount, 0)

    // Get latest compensation entry balance
    const latestEntry = await prisma.compensationEntry.findFirst({
      where: { userId },
      orderBy: [
        { periodYear: 'desc' },
        { periodMonth: 'desc' },
      ],
    })

    return NextResponse.json({
      balance,
      latestCompensationBalance: latestEntry?.balance ?? 0,
      currency: "EUR", // TODO: Get from user settings
    })
  } catch (error: any) {
    console.error("Error fetching balance:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch balance" },
      { status: 500 }
    )
  }
}
