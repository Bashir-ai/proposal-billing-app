import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { AdvanceFrequency } from "@prisma/client"

export const dynamic = "force-dynamic"

function addMonths(date: Date, months: number) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setMonth(d.getMonth() + months)
  d.setHours(0, 0, 0, 0)
  return d
}

function getMonthsForBenefitFrequency(frequency: AdvanceFrequency | null): number {
  switch (frequency) {
    case AdvanceFrequency.MONTHLY:
      return 1
    case AdvanceFrequency.QUARTERLY:
      return 3
    case AdvanceFrequency.YEARLY:
      return 12
    default:
      return 1
  }
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Active, recurring benefits that have started.
    const recurringBenefits = await prisma.fringeBenefit.findMany({
      where: {
        type: "RECURRING",
        isActive: true,
        benefitDate: { lte: today },
        AND: [
          {
            OR: [{ endDate: null }, { endDate: { gte: today } }],
          },
        ],
      },
    })

    let createdOccurrences = 0
    let createdLedgerTx = 0

    for (const benefit of recurringBenefits) {
      if (!benefit.frequency) continue

      const monthsToAdd = getMonthsForBenefitFrequency(benefit.frequency)
      const lastOccurrence = await prisma.fringeBenefitOccurrence.findFirst({
        where: { fringeBenefitId: benefit.id },
        orderBy: { occurrenceDate: "desc" },
        select: { id: true, occurrenceDate: true },
      })

      // If we already have an occurrence, the next candidate is the next scheduled date.
      let candidateDate = lastOccurrence
        ? addMonths(lastOccurrence.occurrenceDate, monthsToAdd)
        : new Date(benefit.benefitDate)
      candidateDate.setHours(0, 0, 0, 0)

      const endDate = benefit.endDate ? new Date(benefit.endDate) : null
      if (endDate) endDate.setHours(0, 0, 0, 0)

      while (candidateDate <= today && (!endDate || candidateDate <= endDate)) {
        const existing = await prisma.fringeBenefitOccurrence.findFirst({
          where: {
            fringeBenefitId: benefit.id,
            occurrenceDate: candidateDate,
          },
          select: { id: true },
        })

        if (!existing) {
          const occurrence = await prisma.fringeBenefitOccurrence.create({
            data: {
              fringeBenefitId: benefit.id,
              userId: benefit.userId,
              occurrenceDate: candidateDate,
              amount: benefit.amount,
              currency: benefit.currency || "EUR",
              status: "PENDING",
              earnedAt: candidateDate,
              paidAmount: 0,
              remainingAmount: benefit.amount,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          })

          createdOccurrences++

          // Credit the user balance when the benefit becomes due/earned.
          await prisma.userFinancialTransaction.create({
            data: {
              userId: benefit.userId,
              type: "COMPENSATION",
              relatedId: occurrence.id,
              relatedType: "FRINGE_BENEFIT_OCCURRENCE",
              amount: benefit.amount,
              currency: occurrence.currency || "EUR",
              transactionDate: candidateDate,
              description: `Fringe benefit earned: ${benefit.description}`,
              notes: null,
              createdBy: benefit.createdBy,
              createdAt: new Date(),
            },
          })
          createdLedgerTx++
        }

        candidateDate = addMonths(candidateDate, monthsToAdd)
      }
    }

    return NextResponse.json({
      success: true,
      today: today.toISOString().slice(0, 10),
      createdOccurrences,
      createdLedgerTx,
    })
  } catch (error: any) {
    console.error("Error processing recurring fringe benefits:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error?.message || String(error) },
      { status: 500 }
    )
  }
}

