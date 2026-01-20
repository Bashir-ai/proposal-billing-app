import { prisma } from "@/lib/prisma"

/**
 * Calculate unbilled project work (timesheet entries + charges) for a specific project
 */
export async function calculateUnbilledProjectWork(projectId: string): Promise<{
  timesheetHours: number
  timesheetAmount: number
  chargesAmount: number
  totalAmount: number
}> {
  // Get unbilled timesheet entries
  const unbilledTimesheets = await prisma.timesheetEntry.findMany({
    where: {
      projectId,
      billed: false,
      billable: true,
    },
  })

  // Calculate timesheet amount
  const timesheetHours = unbilledTimesheets.reduce((sum, entry) => sum + entry.hours, 0)
  const timesheetAmount = unbilledTimesheets.reduce(
    (sum, entry) => sum + (entry.hours * (entry.rate || 0)),
    0
  )

  // Get unbilled project charges
  const unbilledCharges = await prisma.projectCharge.findMany({
    where: {
      projectId,
      billed: false,
    },
  })

  const chargesAmount = unbilledCharges.reduce((sum, charge) => sum + charge.amount, 0)

  return {
    timesheetHours,
    timesheetAmount,
    chargesAmount,
    totalAmount: timesheetAmount + chargesAmount,
  }
}

/**
 * Calculate total unbilled work across all projects (for a user if CLIENT role)
 */
export async function calculateTotalUnbilledWork(
  clientEmail?: string
): Promise<{
  timesheetHours: number
  timesheetAmount: number
  chargesAmount: number
  totalAmount: number
}> {
  const whereClause: any = {
    billed: false,
    billable: true,
  }

  if (clientEmail) {
    const client = await prisma.client.findFirst({
      where: { email: clientEmail },
    })
    if (client) {
      whereClause.project = {
        clientId: client.id,
      }
    } else {
      return { timesheetHours: 0, timesheetAmount: 0, chargesAmount: 0, totalAmount: 0 }
    }
  }

  // Optimized: Use aggregation instead of loading all records
  const timesheetAggregate = await prisma.timesheetEntry.aggregate({
    where: whereClause,
    _sum: {
      hours: true,
    },
  })

  // For amount calculation, we need to sum hours * rate, which requires loading records
  // But we can limit the query
  const unbilledTimesheets = await prisma.timesheetEntry.findMany({
    where: whereClause,
    select: {
      hours: true,
      rate: true,
    },
    take: 10000, // Limit to prevent loading too many records
  })

  const timesheetHours = timesheetAggregate._sum.hours || 0
  const timesheetAmount = unbilledTimesheets.reduce(
    (sum, entry) => sum + (entry.hours * (entry.rate || 0)),
    0
  )

  const chargesWhere: any = {
    billed: false,
  }

  if (clientEmail) {
    const client = await prisma.client.findFirst({
      where: { email: clientEmail },
    })
    if (client) {
      chargesWhere.project = {
        clientId: client.id,
      }
    } else {
      return { timesheetHours, timesheetAmount, chargesAmount: 0, totalAmount: timesheetAmount }
    }
  }

  // Optimized: Use aggregation for charges
  const chargesAggregate = await prisma.projectCharge.aggregate({
    where: chargesWhere,
    _sum: {
      amount: true,
    },
  })

  const chargesAmount = chargesAggregate._sum.amount || 0

  return {
    timesheetHours,
    timesheetAmount,
    chargesAmount,
    totalAmount: timesheetAmount + chargesAmount,
  }
}

/**
 * Calculate closed proposals that haven't been fully charged
 * This includes:
 * 1. Approved proposals without projects created
 * 2. Approved proposals with projects where total invoiced < proposal amount
 */
export async function calculateClosedProposalsNotCharged(
  clientEmail?: string
): Promise<number> {
  // Build where clause for approved proposals
  const proposalWhere: any = {
    status: "APPROVED",
    clientApprovalStatus: "APPROVED",
  }

  if (clientEmail) {
    const client = await prisma.client.findFirst({
      where: { email: clientEmail },
    })
    if (client) {
      proposalWhere.clientId = client.id
    } else {
      return 0
    }
  }

  // Optimized: Use aggregation queries instead of loading all data
  // Get approved proposals with their amounts and projects
  const approvedProposals = await prisma.proposal.findMany({
    where: proposalWhere,
    select: {
      id: true,
      amount: true,
      projects: {
        select: {
          id: true,
        },
      },
    },
  })

  let totalNotCharged = 0

  if (approvedProposals.length === 0) {
    return 0
  }

  // Get all project IDs from all proposals
  const projectIds = approvedProposals.flatMap(p => p.projects.map(proj => proj.id))
  
  // Get total invoiced amounts per project using aggregation (much faster)
  let projectTotalMap = new Map<string, number>()
  
  if (projectIds.length > 0) {
    const projectTotals = await prisma.bill.groupBy({
      by: ['projectId'],
      where: {
        projectId: { in: projectIds },
        status: { in: ["SUBMITTED", "APPROVED", "PAID"] },
        deletedAt: null,
      },
      _sum: {
        amount: true,
      },
    })

    // Create a map of projectId -> total invoiced
    projectTotalMap = new Map(
      projectTotals.map(pt => [pt.projectId || '', pt._sum.amount || 0])
    )
  }

  // Calculate not charged amounts
  for (const proposal of approvedProposals) {
    const proposalAmount = proposal.amount || 0

    if (proposal.projects.length === 0) {
      // No project created - entire proposal amount is not charged
      totalNotCharged += proposalAmount
    } else {
      // Calculate total invoiced across all projects
      let totalInvoiced = 0
      for (const project of proposal.projects) {
        totalInvoiced += projectTotalMap.get(project.id) || 0
      }

      // If invoiced amount is less than proposal amount, add the difference
      if (totalInvoiced < proposalAmount) {
        totalNotCharged += proposalAmount - totalInvoiced
      }
    }
  }

  return totalNotCharged
}





