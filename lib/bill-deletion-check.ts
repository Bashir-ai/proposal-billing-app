import { prisma } from "./prisma"
import { isDatabaseConnectionError } from "./database-error-handler"

/**
 * Check if a bill/invoice can be deleted
 * Returns true if deletion is allowed, false if only archiving is allowed
 */
export async function canDeleteBill(billId: string): Promise<{
  canDelete: boolean
  reason?: string
  isPaid: boolean
  hasApprovals: boolean
  linkedToApprovedProposal: boolean
}> {
  try {
    // Check if bill status is PAID
    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      select: {
        status: true,
        proposalId: true,
        approvals: {
          select: { id: true },
        },
        proposal: {
          select: {
            status: true,
          },
        },
      },
    })

    if (!bill) {
      return {
        canDelete: false,
        reason: "Invoice not found",
        isPaid: false,
        hasApprovals: false,
        linkedToApprovedProposal: false,
      }
    }

    const isPaid = bill.status === "PAID"
    const hasApprovals = (bill.approvals.length || 0) > 0
    const linkedToApprovedProposal = bill.proposalId !== null && bill.proposal?.status === "APPROVED"

    const canDelete = !isPaid && !hasApprovals && !linkedToApprovedProposal

    let reason: string | undefined
    if (!canDelete) {
      const reasons: string[] = []
      if (isPaid) {
        reasons.push("invoice status is PAID")
      }
      if (hasApprovals) {
        reasons.push("invoice has approvals")
      }
      if (linkedToApprovedProposal) {
        reasons.push("invoice is linked to an approved proposal")
      }
      reason = `Cannot delete invoice with ${reasons.join(", ")}. Please archive instead.`
    }

    return {
      canDelete,
      reason,
      isPaid,
      hasApprovals,
      linkedToApprovedProposal,
    }
  } catch (error) {
    // If database connection error, re-throw it so it can be caught upstream
    if (isDatabaseConnectionError(error)) {
      throw error
    }
    // For other errors, return safe defaults
    console.error("Error checking if bill can be deleted:", error)
    return {
      canDelete: false,
      reason: "Unable to validate invoice deletion. Please try again.",
      isPaid: false,
      hasApprovals: false,
      linkedToApprovedProposal: false,
    }
  }
}
