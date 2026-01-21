import { prisma } from "./prisma"
import { BillStatus } from "@prisma/client"

/**
 * Calculate the net invoice amount for finder fees (original amount minus discounts, NO taxes)
 * Net = Subtotal - Discount - Expense Reimbursements
 * Taxes are NOT included in the calculation
 */
export async function calculateInvoiceNetAmount(billId: string): Promise<number> {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      items: true,
    },
  })

  if (!bill) {
    throw new Error("Invoice not found")
  }

  // Start with subtotal (if available) or calculate from items
  // This is the "original amount" before taxes
  let subtotal = bill.subtotal || 0
  if (subtotal === 0) {
    subtotal = bill.items
      .filter((item) => !item.isCredit)
      .reduce((sum, item) => sum + item.amount, 0)
  }

  // Calculate discount
  let discountValue = 0
  if (bill.discountPercent && bill.discountPercent > 0) {
    discountValue = (subtotal * bill.discountPercent) / 100
  } else if (bill.discountAmount && bill.discountAmount > 0) {
    discountValue = bill.discountAmount
  }

  const afterDiscount = subtotal - discountValue

  // Calculate expense reimbursements (credit items)
  const expenseReimbursements = bill.items
    .filter((item) => item.isCredit)
    .reduce((sum, item) => sum + Math.abs(item.amount), 0) // Credit items are negative, take absolute value

  // Net amount = original amount (subtotal) - discount - expense reimbursements
  // Taxes are NOT included in the calculation
  const netAmount = afterDiscount - expenseReimbursements

  return Math.max(0, netAmount) // Ensure non-negative
}

/**
 * Calculate and create finder fees for an invoice when it's paid
 */
export async function calculateAndCreateFinderFees(billId: string): Promise<void> {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      client: {
        include: {
          finders: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  })

  if (!bill) {
    throw new Error("Invoice not found")
  }

  // Check if invoice is paid
  if (bill.status !== BillStatus.PAID || !bill.paidAt) {
    throw new Error("Invoice is not paid")
  }

  // Check if finder fees already exist
  const existingFees = await prisma.finderFee.findMany({
    where: { billId },
  })

  if (existingFees.length > 0) {
    // Finder fees already calculated
    return
  }

  // Finder fees only apply to clients, not leads
  if (!bill.client) {
    // No client, nothing to calculate
    return
  }

  // Get client finders
  const clientFinders = bill.client.finders || []

  if (clientFinders.length === 0) {
    // No finders, nothing to calculate
    return
  }

  // Calculate net invoice amount
  const netAmount = await calculateInvoiceNetAmount(billId)

  if (netAmount <= 0) {
    // No net amount, nothing to calculate
    return
  }

  // Create finder fees for each finder
  const finderFees = await Promise.all(
    clientFinders.map(async (clientFinder) => {
      if (clientFinder.finderFeePercent <= 0) {
        return null // Skip finders with 0% fee
      }

      const finderFeeAmount = (netAmount * clientFinder.finderFeePercent) / 100

      return prisma.finderFee.create({
        data: {
          billId: bill.id,
          clientId: bill.client.id, // Use bill.client.id since we've already verified bill.client exists
          finderId: clientFinder.userId,
          clientFinderId: clientFinder.id,
          invoiceNetAmount: netAmount,
          finderFeePercent: clientFinder.finderFeePercent,
          finderFeeAmount: finderFeeAmount,
          remainingAmount: finderFeeAmount,
          earnedAt: bill.paidAt!,
          status: "PENDING",
        },
      })
    })
  )

  // Filter out nulls (finders with 0% fee)
  const createdFees = finderFees.filter((fee) => fee !== null)

  return
}

/**
 * Get finder fees for a user
 */
export async function getFinderFeesForUser(
  userId: string,
  options?: {
    status?: "PENDING" | "PARTIALLY_PAID" | "PAID"
    clientId?: string
    startDate?: Date
    endDate?: Date
  }
) {
  const where: any = {
    finderId: userId,
  }

  if (options?.status) {
    where.status = options.status
  }

  if (options?.clientId) {
    where.clientId = options.clientId
  }

  if (options?.startDate || options?.endDate) {
    where.earnedAt = {}
    if (options.startDate) {
      where.earnedAt.gte = options.startDate
    }
    if (options.endDate) {
      where.earnedAt.lte = options.endDate
    }
  }

  return prisma.finderFee.findMany({
    where,
    include: {
      bill: {
        select: {
          id: true,
          invoiceNumber: true,
          amount: true,
          paidAt: true,
        },
      },
      client: {
        select: {
          id: true,
          name: true,
          company: true,
        },
      },
      payments: {
        orderBy: {
          paymentDate: "desc",
        },
      },
    },
    orderBy: {
      earnedAt: "desc",
    },
  })
}

