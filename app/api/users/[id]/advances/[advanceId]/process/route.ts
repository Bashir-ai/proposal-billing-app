export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; advanceId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins and managers can process advances
    if (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.MANAGER) {
      return NextResponse.json({ error: "Forbidden - Admin or Manager access required" }, { status: 403 })
    }

    const { id, advanceId } = await params
    const userId = id

    // Get advance
    const advance = await prisma.officeAdvance.findFirst({
      where: {
        id: advanceId,
        userId,
        isActive: true,
        type: "RECURRING",
      },
    })

    if (!advance) {
      return NextResponse.json({ error: "Recurring advance not found or inactive" }, { status: 404 })
    }

    // Check if advance should be processed (based on frequency and dates)
    const now = new Date()
    if (advance.endDate && now > advance.endDate) {
      // Advance has ended, deactivate it
      await prisma.officeAdvance.update({
        where: { id: advanceId },
        data: { isActive: false },
      })
      return NextResponse.json({ message: "Advance has ended and has been deactivated" })
    }

    // Check last transaction for this advance
    const lastTransaction = await prisma.userFinancialTransaction.findFirst({
      where: {
        userId,
        relatedId: advanceId,
        relatedType: "ADVANCE",
      },
      orderBy: { transactionDate: 'desc' },
    })

    // Determine next processing date
    let nextDate = new Date(advance.startDate)
    if (lastTransaction) {
      nextDate = new Date(lastTransaction.transactionDate)
      if (advance.frequency === "MONTHLY") {
        nextDate.setMonth(nextDate.getMonth() + 1)
      } else if (advance.frequency === "QUARTERLY") {
        nextDate.setMonth(nextDate.getMonth() + 3)
      } else if (advance.frequency === "YEARLY") {
        nextDate.setFullYear(nextDate.getFullYear() + 1)
      }
    }

    // Check if it's time to process
    if (now < nextDate) {
      return NextResponse.json({ 
        message: "Not yet time to process this advance",
        nextProcessDate: nextDate,
      })
    }

    // Create transaction
    const transaction = await prisma.userFinancialTransaction.create({
      data: {
        userId,
        type: "ADVANCE",
        relatedId: advanceId,
        relatedType: "ADVANCE",
        amount: -advance.amount, // Negative because it's a credit against the user
        currency: advance.currency,
        transactionDate: nextDate,
        description: advance.description,
        notes: `Recurring advance payment - ${advance.frequency}`,
        createdBy: session.user.id,
      },
    })

    return NextResponse.json({ transaction }, { status: 201 })
  } catch (error: any) {
    console.error("Error processing advance:", error)
    return NextResponse.json(
      { error: error.message || "Failed to process advance" },
      { status: 500 }
    )
  }
}
