import { prisma } from "@/lib/prisma"

/**
 * Calculate unbilled hours and amount for a specific project
 */
export async function calculateProjectUnbilledHours(projectId: string): Promise<{
  hours: number
  amount: number
}> {
  // Fetch unbilled timesheet entries
  const unbilledTimesheets = await prisma.timesheetEntry.findMany({
    where: {
      projectId,
      billed: false,
      billable: true,
    },
    select: {
      hours: true,
      rate: true,
    },
  })

  // Fetch unbilled charges
  const unbilledCharges = await prisma.projectCharge.findMany({
    where: {
      projectId,
      billed: false,
    },
    select: {
      amount: true,
    },
  })

  // Calculate totals
  const timesheetHours = unbilledTimesheets.reduce((sum, entry) => sum + entry.hours, 0)
  const timesheetAmount = unbilledTimesheets.reduce((sum, entry) => {
    return sum + (entry.rate || 0) * entry.hours
  }, 0)

  const chargesAmount = unbilledCharges.reduce((sum, charge) => sum + charge.amount, 0)

  return {
    hours: timesheetHours,
    amount: timesheetAmount + chargesAmount,
  }
}

/**
 * Get total unbilled hours and amount for all projects of a client
 */
export async function getClientUnbilledSummary(clientId: string): Promise<{
  totalHours: number
  totalAmount: number
  projects: Array<{
    projectId: string
    projectName: string
    hours: number
    amount: number
  }>
}> {
  // Get all active projects for the client
  const projects = await prisma.project.findMany({
    where: {
      clientId,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
    },
  })

  // Calculate unbilled for each project
  const projectSummaries = await Promise.all(
    projects.map(async (project) => {
      const summary = await calculateProjectUnbilledHours(project.id)
      return {
        projectId: project.id,
        projectName: project.name,
        hours: summary.hours,
        amount: summary.amount,
      }
    })
  )

  const totalHours = projectSummaries.reduce((sum, p) => sum + p.hours, 0)
  const totalAmount = projectSummaries.reduce((sum, p) => sum + p.amount, 0)

  return {
    totalHours,
    totalAmount,
    projects: projectSummaries,
  }
}
