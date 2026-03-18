import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateInvoiceNumber } from "@/lib/invoice-number"
import { BillStatus, RecurringPaymentFrequency } from "@prisma/client"

export const dynamic = "force-dynamic"

function getMonthsForFrequency(frequency: RecurringPaymentFrequency, customMonths: number | null): number {
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

function computeNextInvoiceDate(args: {
  recurringStartDate: Date
  lastRecurringInvoiceDate: Date | null
  frequency: RecurringPaymentFrequency
  customMonths: number | null
  baseNow?: Date
}) {
  const startDate = new Date(args.recurringStartDate)
  startDate.setHours(0, 0, 0, 0)

  const lastInvoiceDate = args.lastRecurringInvoiceDate
    ? new Date(args.lastRecurringInvoiceDate)
    : startDate
  lastInvoiceDate.setHours(0, 0, 0, 0)

  const monthsToAdd = getMonthsForFrequency(args.frequency, args.customMonths)
  const nextInvoiceDate = new Date(lastInvoiceDate)
  nextInvoiceDate.setMonth(nextInvoiceDate.getMonth() + monthsToAdd)
  nextInvoiceDate.setHours(0, 0, 0, 0)

  return nextInvoiceDate
}

async function getUniqueInvoiceNumber(args: { proposalProposalNumber: string | null; suffix: string }) {
  const baseProposalNumber = args.proposalProposalNumber
  let invoiceNumber: string | null = null

  if (baseProposalNumber) {
    if (baseProposalNumber.startsWith("PROP-")) {
      invoiceNumber = baseProposalNumber.replace("PROP-", "INV-") + args.suffix
    } else {
      invoiceNumber = baseProposalNumber + args.suffix
    }
  } else {
    invoiceNumber = await generateInvoiceNumber()
  }

  if (!invoiceNumber) invoiceNumber = await generateInvoiceNumber()

  // Ensure uniqueness.
  const existing = await prisma.bill.findUnique({ where: { invoiceNumber } })
  if (existing) {
    invoiceNumber = await generateInvoiceNumber()
  }

  return invoiceNumber
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proposalId } = await params
    const session = await getServerSession(authOptions)

    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        client: true,
        items: {
          where: {
            deletedAt: null,
            billingMethod: "RECURRING",
            recurringEnabled: true,
          },
        },
      },
    })

    if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    if (proposal.status !== "APPROVED") {
      return NextResponse.json({ error: "Proposal must be approved before issuing recurring invoices" }, { status: 400 })
    }

    const proposalClientId = proposal.clientId || proposal.client?.id
    if (!proposalClientId) {
      return NextResponse.json({ error: "Proposal must be associated with a client" }, { status: 400 })
    }

    const createdInvoices: Array<{ id: string; dueDate: Date | null }> = []

    // Proposal-level recurring invoice draft (if enabled)
    if (
      proposal.recurringEnabled &&
      proposal.recurringFrequency &&
      proposal.recurringStartDate &&
      (proposal.amount || 0) > 0
    ) {
      const nextInvoiceDate = computeNextInvoiceDate({
        recurringStartDate: proposal.recurringStartDate,
        lastRecurringInvoiceDate: proposal.lastRecurringInvoiceDate,
        frequency: proposal.recurringFrequency,
        customMonths: proposal.recurringCustomMonths,
      })

      if (nextInvoiceDate <= now) {
        const invoiceAmount = proposal.amount || 0
        const taxInclusive = proposal.taxInclusive || false
        const taxRate = proposal.taxRate || null
        const discountPercent = proposal.clientDiscountPercent || null
        const discountAmount = proposal.clientDiscountAmount || null

        let discountValue = 0
        if (discountPercent && discountPercent > 0) {
          discountValue = (invoiceAmount * discountPercent) / 100
        } else if (discountAmount && discountAmount > 0) {
          const proposalTotal = proposal.amount || invoiceAmount
          discountValue = (invoiceAmount * discountAmount) / proposalTotal
        }

        const afterDiscount = invoiceAmount - discountValue

        let finalAmount = afterDiscount
        if (taxRate && taxRate > 0) {
          if (taxInclusive) {
            // Inclusive: final amount already includes tax.
            const taxAmount = (afterDiscount * taxRate) / (100 + taxRate)
            finalAmount = afterDiscount
            void taxAmount
          } else {
            const taxAmount = (afterDiscount * taxRate) / 100
            finalAmount = afterDiscount + taxAmount
          }
        }

        const invoiceNumber = await getUniqueInvoiceNumber({
          proposalProposalNumber: proposal.proposalNumber,
          suffix: "-R",
        })

        const invoice = await prisma.bill.create({
          data: {
            proposalId: proposal.id,
            clientId: proposalClientId,
            createdBy: proposal.createdBy,
            subtotal: invoiceAmount,
            amount: finalAmount,
            invoiceNumber,
            description: `Recurring Payment - ${proposal.title}`,
            taxInclusive,
            taxRate,
            discountPercent,
            discountAmount,
            status: BillStatus.DRAFT,
            dueDate: nextInvoiceDate,
          },
        })

        createdInvoices.push({ id: invoice.id, dueDate: nextInvoiceDate })

        await prisma.proposal.update({
          where: { id: proposal.id },
          data: { lastRecurringInvoiceDate: nextInvoiceDate },
        })
      }
    }

    // Item-level recurring invoice drafts
    for (const item of proposal.items) {
      if (!item.recurringStartDate || !item.recurringFrequency) continue
      const invoiceAmount = item.amount || 0
      if (invoiceAmount <= 0) continue

      const nextInvoiceDate = computeNextInvoiceDate({
        recurringStartDate: item.recurringStartDate,
        lastRecurringInvoiceDate: item.lastRecurringInvoiceDate,
        frequency: item.recurringFrequency,
        customMonths: item.recurringCustomMonths,
      })

      if (nextInvoiceDate > now) continue

      // If a draft already exists for this cycle, skip it.
      const existingDraft = await prisma.bill.findFirst({
        where: {
          proposalId: proposal.id,
          dueDate: nextInvoiceDate,
          status: BillStatus.DRAFT,
          description: `Recurring Payment - ${item.description}`,
        },
      })
      if (existingDraft) continue

      const taxInclusive = proposal.taxInclusive || false
      const taxRate = proposal.taxRate || null
      const discountPercent = proposal.clientDiscountPercent || null
      const discountAmount = proposal.clientDiscountAmount || null

      // Item-level discounts are proportional to the proposal amount (same approach as cron).
      let discountValue = 0
      if (discountPercent && discountPercent > 0) {
        discountValue = (invoiceAmount * discountPercent) / 100
      } else if (discountAmount && discountAmount > 0 && proposal.amount) {
        discountValue = (invoiceAmount * discountAmount) / proposal.amount
      }

      const afterDiscount = invoiceAmount - discountValue

      let finalAmount = afterDiscount
      if (taxRate && taxRate > 0) {
        if (taxInclusive) {
          const taxAmount = (afterDiscount * taxRate) / (100 + taxRate)
          finalAmount = afterDiscount
          void taxAmount
        } else {
          const taxAmount = (afterDiscount * taxRate) / 100
          finalAmount = afterDiscount + taxAmount
        }
      }

      const invoiceNumber = await getUniqueInvoiceNumber({
        proposalProposalNumber: proposal.proposalNumber,
        suffix: "-R",
      })

      const invoice = await prisma.bill.create({
        data: {
          proposalId: item.proposalId,
          clientId: proposalClientId,
          createdBy: proposal.createdBy,
          subtotal: invoiceAmount,
          amount: finalAmount,
          invoiceNumber,
          description: `Recurring Payment - ${item.description}`,
          taxInclusive,
          taxRate,
          discountPercent,
          discountAmount,
          status: BillStatus.DRAFT,
          dueDate: nextInvoiceDate,
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
        select: { id: true },
      })

      createdInvoices.push({ id: invoice.id, dueDate: nextInvoiceDate })

      await prisma.proposalItem.update({
        where: { id: item.id },
        data: { lastRecurringInvoiceDate: nextInvoiceDate },
      })
    }

    return NextResponse.json({
      success: true,
      invoices: createdInvoices,
    })
  } catch (error: any) {
    console.error("Error issuing recurring invoice drafts:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}

