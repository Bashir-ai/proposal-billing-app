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
    // Format: "proposal-{id}", "invoice-{id}", "todo-{id}", or direct notification ID
    if (id.startsWith("proposal-")) {
      // This is a proposal approval notification - handled by approval system
      // No need to mark as read separately
      return NextResponse.json({ message: "Notification marked as read" })
    } else if (id.startsWith("invoice-")) {
      // This is an invoice approval notification - handled by approval system
      // No need to mark as read separately
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
      // Outstanding invoice notification - no persistent storage, just return success
      return NextResponse.json({ message: "Notification marked as read" })
    } else if (id.startsWith("proposal-client-")) {
      // Client approval notification - no persistent storage, just return success
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
