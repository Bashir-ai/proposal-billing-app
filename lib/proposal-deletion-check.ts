import { prisma } from "./prisma"
import { isDatabaseConnectionError } from "./database-error-handler"

/**
 * Check if a proposal can be deleted
 * Returns true if deletion is allowed, false if only archiving is allowed
 */
export async function canDeleteProposal(proposalId: string): Promise<{
  canDelete: boolean
  reason?: string
  approvedInvoices: number
  activeProjects: number
  hasApprovedStatus: boolean
}> {
  try {
    // Check for approved invoices (status APPROVED or PAID, not deleted)
    const approvedInvoices = await prisma.bill.count({
      where: {
        proposalId,
        status: {
          in: ["APPROVED", "PAID"],
        },
        deletedAt: null,
      },
    })

    // Check for active projects (status = ACTIVE, not deleted)
    const activeProjects = await prisma.project.count({
      where: {
        proposalId,
        status: "ACTIVE",
        deletedAt: null,
      },
    })

    // Check if proposal is APPROVED and has any bills
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: {
        status: true,
        bills: {
          where: { deletedAt: null },
          select: { id: true },
        },
      },
    })

    const hasApprovedStatus = proposal?.status === "APPROVED"
    const hasBills = (proposal?.bills.length || 0) > 0

    const canDelete = approvedInvoices === 0 && activeProjects === 0 && !(hasApprovedStatus && hasBills)

    let reason: string | undefined
    if (!canDelete) {
      const reasons: string[] = []
      if (approvedInvoices > 0) {
        reasons.push(`${approvedInvoices} approved or paid invoice(s)`)
      }
      if (activeProjects > 0) {
        reasons.push(`${activeProjects} active project(s)`)
      }
      if (hasApprovedStatus && hasBills) {
        reasons.push("proposal is APPROVED with invoices")
      }
      reason = `Cannot delete proposal with ${reasons.join(", ")}. Please archive instead.`
    }

    return {
      canDelete,
      reason,
      approvedInvoices,
      activeProjects,
      hasApprovedStatus: hasApprovedStatus && hasBills,
    }
  } catch (error) {
    // If database connection error, re-throw it so it can be caught upstream
    if (isDatabaseConnectionError(error)) {
      throw error
    }
    // For other errors, return safe defaults
    console.error("Error checking if proposal can be deleted:", error)
    return {
      canDelete: false,
      reason: "Unable to validate proposal deletion. Please try again.",
      approvedInvoices: 0,
      activeProjects: 0,
      hasApprovedStatus: false,
    }
  }
}
