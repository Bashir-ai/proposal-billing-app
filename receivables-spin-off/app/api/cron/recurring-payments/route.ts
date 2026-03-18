import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { NotificationType, RecurringPaymentFrequency } from "@prisma/client"

export const dynamic = 'force-dynamic'

/**
 * Cron endpoint to check for recurring payment anniversaries
 * Should be called daily (e.g., via Vercel Cron or external cron service)
 * 
 * Checks proposals and proposal items with recurringEnabled=true
 * and creates notifications when it's time to issue a recurring invoice
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

    const notificationsCreated: string[] = []

    // Check proposal-level recurring payments
    const proposalsWithRecurring = await prisma.proposal.findMany({
      where: {
        recurringEnabled: true,
        status: "APPROVED", // Only check approved proposals
        deletedAt: null,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            company: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    for (const proposal of proposalsWithRecurring) {
      if (!proposal.recurringStartDate || !proposal.recurringFrequency) continue

      const startDate = new Date(proposal.recurringStartDate)
      startDate.setHours(0, 0, 0, 0)

      // Calculate next invoice date
      const lastInvoiceDate = proposal.lastRecurringInvoiceDate 
        ? new Date(proposal.lastRecurringInvoiceDate)
        : startDate
      lastInvoiceDate.setHours(0, 0, 0, 0)

      const monthsToAdd = getMonthsForFrequency(proposal.recurringFrequency, proposal.recurringCustomMonths)
      const nextInvoiceDate = new Date(lastInvoiceDate)
      nextInvoiceDate.setMonth(nextInvoiceDate.getMonth() + monthsToAdd)

      // Check if it's time to generate an invoice (on or before the due date)
      if (nextInvoiceDate <= today) {
          const recipients = [proposal.createdBy]
          if (proposal.client?.id) {
            const clientWithManager = await prisma.client.findUnique({
              where: { id: proposal.client.id },
              select: { clientManagerId: true },
            })
            if (clientWithManager?.clientManagerId) {
              recipients.push(clientWithManager.clientManagerId)
            }
          }

          for (const userId of recipients) {
            // Avoid spamming duplicate due notifications for the same due date.
            const existing = await prisma.notification.findFirst({
              where: {
                userId,
                type: NotificationType.RECURRING_PAYMENT_DUE,
                proposalId: proposal.id,
                proposalItemId: null,
                dueDate: nextInvoiceDate,
              },
            })

            if (existing) continue

            const isFirst = !proposal.lastRecurringInvoiceDate
            await prisma.notification.create({
              data: {
                userId,
                type: NotificationType.RECURRING_PAYMENT_DUE,
                proposalId: proposal.id,
                title: `Recurring Payment Due: ${proposal.title}`,
                message: isFirst
                  ? `It's time to generate the first recurring invoice for proposal ${proposal.proposalNumber || proposal.id}`
                  : `It's time to generate the next recurring invoice for proposal ${proposal.proposalNumber || proposal.id}`,
                dueDate: nextInvoiceDate,
              },
            })
            notificationsCreated.push(`Proposal ${proposal.id} - User ${userId}`)
          }
      }
    }

    // Check item-level recurring payments
    const itemsWithRecurring = await prisma.proposalItem.findMany({
      where: {
        recurringEnabled: true,
        billingMethod: "RECURRING",
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
      },
    })

    for (const item of itemsWithRecurring) {
      if (!item.recurringStartDate || !item.recurringFrequency) continue

      const startDate = new Date(item.recurringStartDate)
      startDate.setHours(0, 0, 0, 0)

      const lastInvoiceDate = item.lastRecurringInvoiceDate 
        ? new Date(item.lastRecurringInvoiceDate)
        : startDate
      lastInvoiceDate.setHours(0, 0, 0, 0)

      const monthsToAdd = getMonthsForFrequency(item.recurringFrequency, item.recurringCustomMonths)
      const nextInvoiceDate = new Date(lastInvoiceDate)
      nextInvoiceDate.setMonth(nextInvoiceDate.getMonth() + monthsToAdd)

      if (nextInvoiceDate <= today) {
          const recipients = [item.proposal.createdBy]
          if (item.proposal.client?.clientManagerId) {
            recipients.push(item.proposal.client.clientManagerId)
          }

          for (const userId of recipients) {
            // Avoid spamming duplicate due notifications for the same due date.
            const existing = await prisma.notification.findFirst({
              where: {
                userId,
                type: NotificationType.RECURRING_PAYMENT_DUE,
                proposalId: item.proposalId,
                proposalItemId: item.id,
                dueDate: nextInvoiceDate,
              },
            })
            if (existing) continue

            const isFirst = !item.lastRecurringInvoiceDate
            await prisma.notification.create({
              data: {
                userId,
                type: NotificationType.RECURRING_PAYMENT_DUE,
                proposalId: item.proposalId,
                proposalItemId: item.id,
                title: `Recurring Payment Due: ${item.description}`,
                message: isFirst
                  ? `It's time to generate the first recurring invoice for line item "${item.description}" in proposal ${item.proposal.proposalNumber || item.proposalId}`
                  : `It's time to generate the next recurring invoice for line item "${item.description}" in proposal ${item.proposal.proposalNumber || item.proposalId}`,
                dueDate: nextInvoiceDate,
              },
            })
            notificationsCreated.push(`Item ${item.id} - User ${userId}`)
          }
      }
    }

    return NextResponse.json({
      success: true,
      notificationsCreated: notificationsCreated.length,
      details: notificationsCreated,
    })
  } catch (error) {
    console.error("Error checking recurring payments:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * Helper function to get number of months for a recurring frequency
 */
function getMonthsForFrequency(
  frequency: RecurringPaymentFrequency,
  customMonths: number | null
): number {
  switch (frequency) {
    case RecurringPaymentFrequency.MONTHLY_1:
      return 1
    case RecurringPaymentFrequency.MONTHLY_3:
      return 3
    case RecurringPaymentFrequency.MONTHLY_6:
      return 6
    case RecurringPaymentFrequency.YEARLY_12:
      return 12
    case RecurringPaymentFrequency.CUSTOM:
      return customMonths || 1
    default:
      return 1
  }
}

