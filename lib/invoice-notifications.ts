import { prisma } from "@/lib/prisma"
import { Bill } from "@prisma/client"
import { createOutstandingInvoiceNotification } from "@/lib/notifications"

/**
 * Get all users who should be notified about an outstanding invoice
 * - Client Finders (if assigned)
 * - Client Manager (if assigned)
 * - Project Managers (if project exists)
 * - All Admins
 */
export async function getOutstandingInvoiceRecipients(bill: Bill & {
  client: {
    clientManagerId: string | null
    clientManager?: { id: string; name: string; email: string } | null
    finders?: Array<{
      user: { id: string; name: string; email: string }
    }>
  }
  project?: {
    projectManagers?: Array<{
      user: { id: string; name: string; email: string }
    }>
  } | null
}) {
  const recipientIds = new Set<string>()
  
  // Client Finders (multiple)
  if (bill.client.finders && bill.client.finders.length > 0) {
    bill.client.finders.forEach((finder) => {
      recipientIds.add(finder.user.id)
    })
  }
  
  // Client Manager
  if (bill.client.clientManagerId) {
    recipientIds.add(bill.client.clientManagerId)
  }
  
  // Project Managers
  if (bill.project?.projectManagers) {
    bill.project.projectManagers.forEach((pm) => {
      recipientIds.add(pm.user.id)
    })
  }
  
  // All Admins
  const admins = await prisma.user.findMany({
    where: {
      role: "ADMIN",
    },
    select: {
      id: true,
    },
  })
  
  admins.forEach((admin) => {
    recipientIds.add(admin.id)
  })
  
  return Array.from(recipientIds)
}

/**
 * Notify all recipients about an outstanding invoice
 */
export async function notifyOutstandingInvoice(
  bill: Bill & {
    client: {
      clientManagerId: string | null
      clientManager?: { id: string; name: string; email: string } | null
      finders?: Array<{
        user: { id: string; name: string; email: string }
      }>
    }
    project?: {
      projectManagers?: Array<{
        user: { id: string; name: string; email: string }
      }>
    } | null
  },
  isFirstTime: boolean,
  reminderNumber: number = 0
) {
  const recipientIds = await getOutstandingInvoiceRecipients(bill)
  
  // Create notifications for all recipients
  await Promise.all(
    recipientIds.map((userId) =>
      createOutstandingInvoiceNotification(bill.id, userId, reminderNumber, isFirstTime)
    )
  )
  
  return recipientIds.length
}

