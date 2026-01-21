export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse notification ID to determine type
    // Format: "proposal-{id}", "invoice-{id}", "todo-{id}", "invoice-outstanding-{id}", "proposal-client-{id}", or direct notification ID
    if (id.startsWith("proposal-") && !id.startsWith("proposal-client-")) {
      // This is a proposal approval notification
      const proposalId = id.replace("proposal-", "")
      // Create or update NotificationRead record
      await prisma.notificationRead.upsert({
        where: {
          userId_notificationType_itemId: {
            userId: session.user.id,
            notificationType: "proposal_approval",
            itemId: proposalId,
          },
        },
        update: {
          readAt: new Date(),
        },
        create: {
          userId: session.user.id,
          notificationType: "proposal_approval",
          itemId: proposalId,
          readAt: new Date(),
        },
      })
      return NextResponse.json({ message: "Notification marked as read" })
    } else if (id.startsWith("invoice-") && !id.startsWith("invoice-outstanding-")) {
      // This is an invoice approval notification
      const invoiceId = id.replace("invoice-", "")
      // Create or update NotificationRead record
      await prisma.notificationRead.upsert({
        where: {
          userId_notificationType_itemId: {
            userId: session.user.id,
            notificationType: "invoice_approval",
            itemId: invoiceId,
          },
        },
        update: {
          readAt: new Date(),
        },
        create: {
          userId: session.user.id,
          notificationType: "invoice_approval",
          itemId: invoiceId,
          readAt: new Date(),
        },
      })
      return NextResponse.json({ message: "Notification marked as read" })
    } else if (id.startsWith("todo-")) {
      // Mark todo as read
      const todoId = id.replace("todo-", "")
      await prisma.todo.update({
        where: { id: todoId },
        data: { readAt: new Date() },
      })
      return NextResponse.json({ message: "Todo marked as read" })
    } else if (id.startsWith("invoice-outstanding-")) {
      // Outstanding invoice notification
      const invoiceId = id.replace("invoice-outstanding-", "")
      // Determine notification type (could be invoice_outstanding or invoice_reminder)
      // We'll use invoice_outstanding as the default type
      await prisma.notificationRead.upsert({
        where: {
          userId_notificationType_itemId: {
            userId: session.user.id,
            notificationType: "invoice_outstanding",
            itemId: invoiceId,
          },
        },
        update: {
          readAt: new Date(),
        },
        create: {
          userId: session.user.id,
          notificationType: "invoice_outstanding",
          itemId: invoiceId,
          readAt: new Date(),
        },
      })
      return NextResponse.json({ message: "Notification marked as read" })
    } else if (id.startsWith("proposal-client-")) {
      // Client approval notification
      const proposalId = id.replace("proposal-client-", "")
      // Determine notification type (could be proposal_pending_client or proposal_pending_client_overdue)
      // We'll check both types and mark the appropriate one
      // For simplicity, we'll mark both if they exist
      const notificationTypes = ["proposal_pending_client", "proposal_pending_client_overdue"]
      for (const notificationType of notificationTypes) {
        await prisma.notificationRead.upsert({
          where: {
            userId_notificationType_itemId: {
              userId: session.user.id,
              notificationType,
              itemId: proposalId,
            },
          },
          update: {
            readAt: new Date(),
          },
          create: {
            userId: session.user.id,
            notificationType,
            itemId: proposalId,
            readAt: new Date(),
          },
        })
      }
      return NextResponse.json({ message: "Notification marked as read" })
    } else {
      // Direct notification ID from Notification model
      const notification = await prisma.notification.findUnique({
        where: { id },
      })

      if (!notification) {
        return NextResponse.json({ error: "Notification not found" }, { status: 404 })
      }

      // Check if user owns this notification
      if (notification.userId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      // Mark as read
      await prisma.notification.update({
        where: { id },
        data: { readAt: new Date() },
      })

      return NextResponse.json({ message: "Notification marked as read" })
    }
  } catch (error) {
    console.error("Error marking notification as read:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
