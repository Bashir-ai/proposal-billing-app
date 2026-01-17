import { prisma } from "./prisma"
import { isDatabaseConnectionError } from "./database-error-handler"

/**
 * Check if a lead can be deleted
 * Returns true if deletion is allowed, false if only archiving is allowed
 */
export async function canDeleteLead(leadId: string): Promise<{
  canDelete: boolean
  reason?: string
  isConverted: boolean
  activeProposals: number
}> {
  try {
    // Check if lead has been converted to client
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        convertedToClientId: true,
      },
    })

    const isConverted = lead?.convertedToClientId !== null

    // Check for active proposals (status DRAFT or SUBMITTED, not deleted)
    const activeProposals = await prisma.proposal.count({
      where: {
        leadId,
        status: {
          in: ["DRAFT", "SUBMITTED"],
        },
        deletedAt: null,
      },
    })

    const canDelete = !isConverted && activeProposals === 0

    let reason: string | undefined
    if (!canDelete) {
      const reasons: string[] = []
      if (isConverted) {
        reasons.push("lead has been converted to client")
      }
      if (activeProposals > 0) {
        reasons.push(`${activeProposals} active proposal(s)`)
      }
      reason = `Cannot delete lead with ${reasons.join(", ")}. Please archive instead.`
    }

    return {
      canDelete,
      reason,
      isConverted,
      activeProposals,
    }
  } catch (error) {
    // If database connection error, re-throw it so it can be caught upstream
    if (isDatabaseConnectionError(error)) {
      throw error
    }
    // For other errors, return safe defaults
    console.error("Error checking if lead can be deleted:", error)
    return {
      canDelete: false,
      reason: "Unable to validate lead deletion. Please try again.",
      isConverted: false,
      activeProposals: 0,
    }
  }
}
