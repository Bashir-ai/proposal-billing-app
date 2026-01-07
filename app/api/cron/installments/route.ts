import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { NotificationType } from "@prisma/client"

/**
 * Cron endpoint to check for installment due dates
 * Should be called daily (e.g., via Vercel Cron or external cron service)
 * 
 * Checks payment terms with installments and creates notifications
 * when installment due dates are approaching (7 days before) or due
 */
export async function GET(request: Request) {
  try {
    // Verify this is a cron request (add authentication header check in production)
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sevenDaysFromNow = new Date(today)
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    const notificationsCreated: string[] = []

    // Find payment terms with installments
    const paymentTermsWithInstallments = await prisma.paymentTerm.findMany({
      where: {
        installmentType: { not: null },
        installmentCount: { gt: 0 },
        proposal: {
          status: "APPROVED",
          deletedAt: null,
        },
      },
      include: {
        proposal: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
                company: true,
                clientManagerId: true,
              },
            },
            creator: {
              select: {
                id: true,
              },
            },
          },
        },
        proposalItem: {
          select: {
            id: true,
            description: true,
            amount: true,
          },
        },
        installmentInvoices: {
          select: {
            installmentNumber: true,
            dueDate: true,
            invoicedAt: true,
          },
        },
      },
    })

    for (const paymentTerm of paymentTermsWithInstallments) {
      if (!paymentTerm.installmentCount) continue

      // Get installment maturity dates
      const maturityDates = paymentTerm.installmentMaturityDates || []
      
      // If no custom maturity dates, calculate them based on frequency
      let datesToCheck: Date[] = []
      if (maturityDates.length > 0) {
        datesToCheck = maturityDates.map(d => new Date(d))
      } else if (paymentTerm.installmentType === "TIME_BASED" && paymentTerm.installmentFrequency) {
        // Calculate dates based on frequency (fallback)
        const startDate = paymentTerm.proposal?.issueDate 
          ? new Date(paymentTerm.proposal.issueDate)
          : new Date()
        datesToCheck = calculateInstallmentDates(
          startDate,
          paymentTerm.installmentCount,
          paymentTerm.installmentFrequency
        )
      } else if (paymentTerm.installmentType === "MILESTONE_BASED" && paymentTerm.milestoneIds.length > 0) {
        // Get milestone due dates
        const milestones = await prisma.milestone.findMany({
          where: {
            id: { in: paymentTerm.milestoneIds },
          },
          select: {
            id: true,
            dueDate: true,
          },
        })
        datesToCheck = milestones
          .filter(m => m.dueDate)
          .map(m => new Date(m.dueDate!))
          .sort((a, b) => a.getTime() - b.getTime())
      }

      // Check each installment date
      for (let i = 0; i < datesToCheck.length && i < paymentTerm.installmentCount; i++) {
        const dueDate = datesToCheck[i]
        dueDate.setHours(0, 0, 0, 0)

        // Check if this installment has already been invoiced
        const invoicedInstallments = paymentTerm.installmentInvoices || []
        const isInvoiced = invoicedInstallments.some(
          inv => inv.installmentNumber === i + 1 && inv.invoicedAt !== null
        )

        if (isInvoiced) continue

        // Create notification if due date is within 7 days or past due
        if (dueDate <= sevenDaysFromNow && dueDate >= today) {
          const recipients = [paymentTerm.proposal!.createdBy]
          if (paymentTerm.proposal!.client?.clientManagerId) {
            recipients.push(paymentTerm.proposal!.client.clientManagerId)
          }

          const itemDescription = paymentTerm.proposalItem?.description || "Proposal"
          const installmentAmount = calculateInstallmentAmount(
            paymentTerm.proposal!,
            paymentTerm.proposalItem,
            paymentTerm.installmentCount || 1,
            i + 1
          )

          for (const userId of recipients) {
            await prisma.notification.create({
              data: {
                userId,
                type: NotificationType.INSTALLMENT_DUE,
                proposalId: paymentTerm.proposalId || undefined,
                proposalItemId: paymentTerm.proposalItemId || undefined,
                paymentTermId: paymentTerm.id,
                title: `Installment Due: ${itemDescription}`,
                message: `Installment ${i + 1} of ${paymentTerm.installmentCount} is due on ${dueDate.toLocaleDateString()}. Amount: ${paymentTerm.proposal!.currency} ${installmentAmount.toFixed(2)}`,
                dueDate: dueDate,
              },
            })
            notificationsCreated.push(`PaymentTerm ${paymentTerm.id} - Installment ${i + 1} - User ${userId}`)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      notificationsCreated: notificationsCreated.length,
      details: notificationsCreated,
    })
  } catch (error) {
    console.error("Error checking installments:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * Calculate installment dates based on frequency
 */
function calculateInstallmentDates(
  startDate: Date,
  count: number,
  frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY"
): Date[] {
  const dates: Date[] = []
  const monthsPerFrequency = frequency === "WEEKLY" ? 0.25 : frequency === "MONTHLY" ? 1 : 3

  for (let i = 0; i < count; i++) {
    const date = new Date(startDate)
    date.setMonth(date.getMonth() + (i + 1) * monthsPerFrequency)
    dates.push(date)
  }

  return dates
}

/**
 * Calculate installment amount
 */
function calculateInstallmentAmount(
  proposal: any,
  proposalItem: any,
  totalInstallments: number,
  installmentNumber: number
): number {
  const baseAmount = proposalItem?.amount || proposal.amount || 0
  
  // Subtract upfront payment if exists
  let remainingAmount = baseAmount
  if (proposal.paymentTerms && proposal.paymentTerms.length > 0) {
    const paymentTerm = proposal.paymentTerms.find((pt: any) => !pt.proposalItemId)
    if (paymentTerm?.upfrontType && paymentTerm?.upfrontValue) {
      if (paymentTerm.upfrontType === "PERCENT") {
        remainingAmount = baseAmount * (1 - paymentTerm.upfrontValue / 100)
      } else {
        remainingAmount = baseAmount - paymentTerm.upfrontValue
      }
    }
  }

  // Divide remaining amount by number of installments
  return remainingAmount / totalInstallments
}


