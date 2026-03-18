import { prisma } from "./prisma"
import { isDatabaseConnectionError } from "./database-error-handler"

/**
 * Check if a project can be deleted
 * Returns true if deletion is allowed, false if only archiving is allowed
 */
export async function canDeleteProject(projectId: string): Promise<{
  canDelete: boolean
  reason?: string
  activeTimesheets: number
  unpaidInvoices: number
  isActive: boolean
}> {
  try {
    // Check for active timesheets (billed = false, not deleted)
    const activeTimesheets = await prisma.timesheetEntry.count({
      where: {
        projectId,
        billed: false,
      },
    })

    // Check for unpaid invoices (status != PAID, not deleted)
    const unpaidInvoices = await prisma.bill.count({
      where: {
        projectId,
        status: {
          not: "PAID",
        },
        deletedAt: null,
      },
    })

    // Check if project status is ACTIVE
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        status: true,
      },
    })

    const isActive = project?.status === "ACTIVE"

    const canDelete = activeTimesheets === 0 && unpaidInvoices === 0 && !isActive

    let reason: string | undefined
    if (!canDelete) {
      const reasons: string[] = []
      if (activeTimesheets > 0) {
        reasons.push(`${activeTimesheets} unbilled timesheet entry/entries`)
      }
      if (unpaidInvoices > 0) {
        reasons.push(`${unpaidInvoices} unpaid invoice(s)`)
      }
      if (isActive) {
        reasons.push("project status is ACTIVE")
      }
      reason = `Cannot delete project with ${reasons.join(", ")}. Please archive instead.`
    }

    return {
      canDelete,
      reason,
      activeTimesheets,
      unpaidInvoices,
      isActive,
    }
  } catch (error) {
    // If database connection error, re-throw it so it can be caught upstream
    if (isDatabaseConnectionError(error)) {
      throw error
    }
    // For other errors, return safe defaults
    console.error("Error checking if project can be deleted:", error)
    return {
      canDelete: false,
      reason: "Unable to validate project deletion. Please try again.",
      activeTimesheets: 0,
      unpaidInvoices: 0,
      isActive: false,
    }
  }
}
