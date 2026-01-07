import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { NotificationType, RecurringPaymentFrequency, BillStatus } from "@prisma/client"
import { generateInvoiceNumber } from "@/lib/invoice-number"

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
        // Only generate invoice if first invoice was already generated (lastRecurringInvoiceDate exists)
        if (proposal.lastRecurringInvoiceDate) {
          // Generate invoice automatically
          try {
            // Calculate invoice amount
            const invoiceAmount = proposal.amount || 0
            if (invoiceAmount > 0) {
              // Generate invoice number
              let invoiceNumber: string | null = null
              if (proposal.proposalNumber) {
                const proposalNum = proposal.proposalNumber
                if (proposalNum.startsWith("PROP-")) {
                  invoiceNumber = proposalNum.replace("PROP-", "INV-") + "-R"
                } else {
                  invoiceNumber = proposalNum + "-R"
                }
              } else {
                invoiceNumber = await generateInvoiceNumber()
              }

              // Check if invoice number already exists
              if (invoiceNumber) {
                const existingInvoice = await prisma.bill.findUnique({
                  where: { invoiceNumber },
                })
                if (existingInvoice) {
                  invoiceNumber = await generateInvoiceNumber()
                }
              }

              // Calculate tax and discount (inherit from proposal)
              const taxInclusive = proposal.taxInclusive || false
              const taxRate = proposal.taxRate || null
              const discountPercent = proposal.clientDiscountPercent || null
              const discountAmount = proposal.clientDiscountAmount || null

              // Calculate discount
              let discountValue = 0
              if (discountPercent && discountPercent > 0) {
                discountValue = (invoiceAmount * discountPercent) / 100
              } else if (discountAmount && discountAmount > 0) {
                const proposalTotal = proposal.amount || invoiceAmount
                discountValue = (invoiceAmount * discountAmount) / proposalTotal
              }

              const afterDiscount = invoiceAmount - discountValue

              // Calculate tax
              let taxAmount = 0
              let finalAmount = afterDiscount

              if (taxRate && taxRate > 0) {
                if (taxInclusive) {
                  taxAmount = (afterDiscount * taxRate) / (100 + taxRate)
                  finalAmount = afterDiscount
                } else {
                  taxAmount = (afterDiscount * taxRate) / 100
                  finalAmount = afterDiscount + taxAmount
                }
              }

              // Create recurring invoice
              const invoice = await prisma.bill.create({
                data: {
                  proposalId: proposal.id,
                  clientId: proposal.clientId || proposal.client!.id,
                  createdBy: proposal.createdBy,
                  subtotal: invoiceAmount,
                  amount: finalAmount,
                  invoiceNumber: invoiceNumber,
                  description: `Recurring Payment - ${proposal.title}`,
                  taxInclusive: taxInclusive,
                  taxRate: taxRate,
                  discountPercent: discountPercent,
                  discountAmount: discountAmount,
                  status: BillStatus.DRAFT,
                },
              })

              // Update lastRecurringInvoiceDate
              await prisma.proposal.update({
                where: { id: proposal.id },
                data: {
                  lastRecurringInvoiceDate: new Date(),
                },
              })

              notificationsCreated.push(`Invoice generated for Proposal ${proposal.id} - Invoice ${invoice.id}`)
            }
          } catch (error: any) {
            console.error(`Error generating recurring invoice for proposal ${proposal.id}:`, error)
            // Create notification about the error instead
            await prisma.notification.create({
              data: {
                userId: proposal.createdBy,
                type: NotificationType.RECURRING_PAYMENT_DUE,
                proposalId: proposal.id,
                title: `Recurring Payment Due: ${proposal.title}`,
                message: `Failed to automatically generate recurring invoice. Please generate manually. Error: ${error.message}`,
                dueDate: nextInvoiceDate,
              },
            })
            notificationsCreated.push(`Error generating invoice for Proposal ${proposal.id}`)
          }
        } else {
          // First invoice not yet generated - create notification to generate it manually
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
            await prisma.notification.create({
              data: {
                userId,
                type: NotificationType.RECURRING_PAYMENT_DUE,
                proposalId: proposal.id,
                title: `Recurring Payment Due: ${proposal.title}`,
                message: `It's time to generate the first recurring invoice for proposal ${proposal.proposalNumber || proposal.id}`,
                dueDate: nextInvoiceDate,
              },
            })
            notificationsCreated.push(`Proposal ${proposal.id} - User ${userId}`)
          }
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
        // Only generate invoice if first invoice was already generated (lastRecurringInvoiceDate exists)
        if (item.lastRecurringInvoiceDate) {
          // Generate invoice automatically for this item
          try {
            const invoiceAmount = item.amount || 0
            if (invoiceAmount > 0) {
              // Generate invoice number
              let invoiceNumber: string | null = null
              if (item.proposal.proposalNumber) {
                const proposalNum = item.proposal.proposalNumber
                if (proposalNum.startsWith("PROP-")) {
                  invoiceNumber = proposalNum.replace("PROP-", "INV-") + "-R"
                } else {
                  invoiceNumber = proposalNum + "-R"
                }
              } else {
                invoiceNumber = await generateInvoiceNumber()
              }

              // Check if invoice number already exists
              if (invoiceNumber) {
                const existingInvoice = await prisma.bill.findUnique({
                  where: { invoiceNumber },
                })
                if (existingInvoice) {
                  invoiceNumber = await generateInvoiceNumber()
                }
              }

              // Get proposal tax/discount settings
              const proposal = await prisma.proposal.findUnique({
                where: { id: item.proposalId },
                select: {
                  taxInclusive: true,
                  taxRate: true,
                  clientDiscountPercent: true,
                  clientDiscountAmount: true,
                  amount: true,
                },
              })

              const taxInclusive = proposal?.taxInclusive || false
              const taxRate = proposal?.taxRate || null
              const discountPercent = proposal?.clientDiscountPercent || null
              const discountAmount = proposal?.clientDiscountAmount || null

              // Calculate discount
              let discountValue = 0
              if (discountPercent && discountPercent > 0) {
                discountValue = (invoiceAmount * discountPercent) / 100
              } else if (discountAmount && discountAmount > 0 && proposal?.amount) {
                discountValue = (invoiceAmount * discountAmount) / proposal.amount
              }

              const afterDiscount = invoiceAmount - discountValue

              // Calculate tax
              let taxAmount = 0
              let finalAmount = afterDiscount

              if (taxRate && taxRate > 0) {
                if (taxInclusive) {
                  taxAmount = (afterDiscount * taxRate) / (100 + taxRate)
                  finalAmount = afterDiscount
                } else {
                  taxAmount = (afterDiscount * taxRate) / 100
                  finalAmount = afterDiscount + taxAmount
                }
              }

              // Create recurring invoice
              const invoice = await prisma.bill.create({
                data: {
                  proposalId: item.proposalId,
                  clientId: item.proposal.clientId || item.proposal.client!.id,
                  createdBy: item.proposal.createdBy,
                  subtotal: invoiceAmount,
                  amount: finalAmount,
                  invoiceNumber: invoiceNumber,
                  description: `Recurring Payment - ${item.description}`,
                  taxInclusive: taxInclusive,
                  taxRate: taxRate,
                  discountPercent: discountPercent,
                  discountAmount: discountAmount,
                  status: BillStatus.DRAFT,
                  items: {
                    create: {
                      type: "CHARGE",
                      description: item.description,
                      quantity: item.quantity || 1,
                      unitPrice: item.unitPrice || item.amount,
                      amount: item.amount,
                      isCredit: false,
                    },
                  },
                },
              })

              // Update item's lastRecurringInvoiceDate
              await prisma.proposalItem.update({
                where: { id: item.id },
                data: {
                  lastRecurringInvoiceDate: new Date(),
                },
              })

              notificationsCreated.push(`Invoice generated for Item ${item.id} - Invoice ${invoice.id}`)
            }
          } catch (error: any) {
            console.error(`Error generating recurring invoice for item ${item.id}:`, error)
            // Create notification about the error
            await prisma.notification.create({
              data: {
                userId: item.proposal.createdBy,
                type: NotificationType.RECURRING_PAYMENT_DUE,
                proposalId: item.proposalId,
                proposalItemId: item.id,
                title: `Recurring Payment Due: ${item.description}`,
                message: `Failed to automatically generate recurring invoice. Please generate manually. Error: ${error.message}`,
                dueDate: nextInvoiceDate,
              },
            })
            notificationsCreated.push(`Error generating invoice for Item ${item.id}`)
          }
        } else {
          // First invoice not yet generated - create notification
          const recipients = [item.proposal.createdBy]
          if (item.proposal.client?.clientManagerId) {
            recipients.push(item.proposal.client.clientManagerId)
          }

          for (const userId of recipients) {
            await prisma.notification.create({
              data: {
                userId,
                type: NotificationType.RECURRING_PAYMENT_DUE,
                proposalId: item.proposalId,
                proposalItemId: item.id,
                title: `Recurring Payment Due: ${item.description}`,
                message: `It's time to generate the first recurring invoice for line item "${item.description}" in proposal ${item.proposal.proposalNumber || item.proposalId}`,
                dueDate: nextInvoiceDate,
              },
            })
            notificationsCreated.push(`Item ${item.id} - User ${userId}`)
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

