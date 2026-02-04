export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch all read notification records for this user
    const readNotifications = await prisma.notificationRead.findMany({
      where: { userId: session.user.id },
      select: {
        notificationType: true,
        itemId: true,
      },
    })

    // Also check Notification model for read notifications
    const readNotificationRecords = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
        readAt: { not: null },
      },
      select: {
        id: true,
      },
    })

    // Build array of notification IDs in the format used by the frontend
    const readIds: string[] = []
    
    // Add NotificationRead records (format: proposal-{id}, invoice-{id}, etc.)
    readNotifications.forEach(r => {
      if (r.notificationType === "proposal_approval") {
        readIds.push(`proposal-${r.itemId}`)
      } else if (r.notificationType === "invoice_approval") {
        readIds.push(`invoice-${r.itemId}`)
      } else if (r.notificationType === "invoice_outstanding" || r.notificationType === "invoice_reminder") {
        readIds.push(`invoice-outstanding-${r.itemId}`)
      } else if (r.notificationType === "proposal_pending_client" || r.notificationType === "proposal_pending_client_overdue") {
        readIds.push(`proposal-client-${r.itemId}`)
      }
    })

    // Add Notification model records (direct IDs)
    readNotificationRecords.forEach(n => {
      readIds.push(n.id)
    })

    // Also check Todo readAt
    const readTodos = await prisma.todo.findMany({
      where: {
        OR: [
          { assignedTo: session.user.id },
          { assignments: { some: { userId: session.user.id } } },
        ],
        readAt: { not: null },
      },
      select: {
        id: true,
      },
    })

    readTodos.forEach(todo => {
      readIds.push(`todo-${todo.id}`)
    })

    return NextResponse.json({ readIds })
  } catch (error) {
    console.error("Error fetching read notification status:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
