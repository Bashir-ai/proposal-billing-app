import { prisma } from "@/lib/prisma"

/**
 * Determine if a client is active based on recent activity
 * A client is considered active if they have proposals, invoices, or projects
 * in the last 6-12 months
 */
export async function isClientActive(clientId: string, months: number = 6): Promise<boolean> {
  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - months)

  // Check for recent proposals
  const recentProposals = await prisma.proposal.findFirst({
    where: {
      clientId,
      createdAt: {
        gte: cutoffDate,
      },
    },
  })

  if (recentProposals) {
    return true
  }

  // Check for recent invoices
  const recentBills = await prisma.bill.findFirst({
    where: {
      clientId,
      createdAt: {
        gte: cutoffDate,
      },
    },
  })

  if (recentBills) {
    return true
  }

  // Check for recent projects
  const recentProjects = await prisma.project.findFirst({
    where: {
      clientId,
      createdAt: {
        gte: cutoffDate,
      },
    },
  })

  if (recentProjects) {
    return true
  }

  return false
}

/**
 * Get all client IDs with their activity status
 */
export async function getClientActivityMap(
  months: number = 6
): Promise<Map<string, boolean>> {
  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - months)

  const clients = await prisma.client.findMany({
    select: {
      id: true,
    },
  })

  const activityMap = new Map<string, boolean>()

  // Batch check for activity
  for (const client of clients) {
    const isActive = await isClientActive(client.id, months)
    activityMap.set(client.id, isActive)
  }

  return activityMap
}






