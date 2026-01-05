import { prisma } from "./prisma"

/**
 * Check if a client can be deleted (not archived)
 * Returns true if deletion is allowed, false if only archiving is allowed
 */
export async function canDeleteClient(clientId: string): Promise<{
  canDelete: boolean
  reason?: string
  ongoingProjects: number
  openInvoices: number
  openProposals: number
}> {
  // Check for ongoing projects (status = ACTIVE, not deleted)
  const ongoingProjects = await prisma.project.count({
    where: {
      clientId,
      status: "ACTIVE",
      deletedAt: null,
    },
  })

  // Check for open invoices (status != PAID, not deleted)
  const openInvoices = await prisma.bill.count({
    where: {
      clientId,
      status: {
        not: "PAID",
      },
      deletedAt: null,
    },
  })

  // Check for open proposals (status IN [DRAFT, SUBMITTED], not deleted)
  const openProposals = await prisma.proposal.count({
    where: {
      clientId,
      status: {
        in: ["DRAFT", "SUBMITTED"],
      },
      deletedAt: null,
    },
  })

  const canDelete = ongoingProjects === 0 && openInvoices === 0 && openProposals === 0

  let reason: string | undefined
  if (!canDelete) {
    const reasons: string[] = []
    if (ongoingProjects > 0) {
      reasons.push(`${ongoingProjects} ongoing project(s)`)
    }
    if (openInvoices > 0) {
      reasons.push(`${openInvoices} open invoice(s)`)
    }
    if (openProposals > 0) {
      reasons.push(`${openProposals} open proposal(s)`)
    }
    reason = `Cannot delete client with ${reasons.join(", ")}. Please archive instead.`
  }

  return {
    canDelete,
    reason,
    ongoingProjects,
    openInvoices,
    openProposals,
  }
}

