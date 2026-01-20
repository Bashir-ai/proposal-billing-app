import { prisma } from "@/lib/prisma"
import { Bill } from "@prisma/client"

/**
 * Check if an invoice is outstanding
 * Outstanding = status != PAID && dueDate < now
 */
export function isInvoiceOutstanding(bill: Bill): boolean {
  if (bill.status === "PAID") {
    return false
  }
  
  if (!bill.dueDate) {
    return false
  }
  
  const now = new Date()
  const dueDate = new Date(bill.dueDate)
  
  return dueDate < now
}

/**
 * Get all outstanding invoices
 */
export async function getOutstandingInvoices() {
  const now = new Date()
  
  return await prisma.bill.findMany({
    where: {
      deletedAt: null,
      status: { not: "PAID" },
      dueDate: { lt: now },
    },
    include: {
      client: {
        include: {
          finders: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          clientManager: { select: { id: true, name: true, email: true } },
        },
      },
      project: {
        include: {
          projectManagers: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  })
}

