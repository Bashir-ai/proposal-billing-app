export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendUserNotificationEmail } from "@/lib/email"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role === "CLIENT") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const notification = await prisma.notification.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 })
    }

    if (!notification.user.email) {
      return NextResponse.json(
        { error: "User email is not set" },
        { status: 400 }
      )
    }

    // Determine URL based on notification type
    let url: string | undefined
    if (notification.proposalId) {
      url = `/dashboard/proposals/${notification.proposalId}`
    } else if (notification.proposalItemId) {
      // Navigate to proposal item's parent proposal if available
      url = `/dashboard`
    } else {
      url = `/dashboard`
    }

    // Send email
    const result = await sendUserNotificationEmail(
      notification.user.email,
      notification.user.name,
      {
        title: notification.title,
        message: notification.message ?? "",
        type: notification.type,
        url,
      }
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send email" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Notification email sent successfully",
    })
  } catch (error: any) {
    console.error("Error sending notification email:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}


