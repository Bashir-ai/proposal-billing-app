export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { TodoPriority } from "@prisma/client"
import { getNotifications } from "@/lib/notifications"

const createTodoFromNotificationSchema = z.object({
  notificationId: z.string(),
  notificationType: z.string(),
  itemId: z.string(),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
})

/**
 * Creates a Todo from a notification that needs attention
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createTodoFromNotificationSchema.parse(body)

    // Get the notification details
    const { notifications } = await getNotifications(session.user.id, session.user.role)
    const notification = notifications.find(n => n.id === validatedData.notificationId)

    if (!notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 })
    }

    // Determine title and description based on notification type
    let title = ""
    let description = ""
    let projectId: string | undefined
    let proposalId: string | undefined
    let invoiceId: string | undefined
    let clientId: string | undefined
    let priority: TodoPriority = TodoPriority.MEDIUM

    switch (notification.type) {
      case "proposal_approval":
        title = `Review Proposal: ${notification.title}`
        description = `Proposal ${notification.proposalNumber || notification.itemId} requires your approval`
        proposalId = notification.itemId
        priority = TodoPriority.HIGH
        break
      case "invoice_approval":
        title = `Review Invoice: ${notification.title}`
        description = `Invoice ${notification.invoiceNumber || notification.itemId} requires your approval`
        invoiceId = notification.itemId
        priority = TodoPriority.HIGH
        break
      case "proposal_pending_client":
      case "proposal_pending_client_overdue":
        title = `Follow up on Proposal: ${notification.title}`
        description = `Proposal ${notification.proposalNumber || notification.itemId} is pending client approval${notification.type.includes("overdue") ? " (OVERDUE)" : ""}`
        proposalId = notification.itemId
        priority = notification.type.includes("overdue") ? TodoPriority.HIGH : TodoPriority.MEDIUM
        break
      case "todo_assignment":
        // This is already a todo, so we might not need to create another one
        // But we can create a follow-up todo if needed
        const existingTodo = await prisma.todo.findUnique({
          where: { id: notification.itemId },
        })
        if (existingTodo) {
          return NextResponse.json({ 
            error: "Todo already exists",
            todo: existingTodo 
          }, { status: 400 })
        }
        title = notification.title
        description = "Todo assignment requires attention"
        break
      case "invoice_outstanding":
      case "invoice_reminder":
        title = `Follow up on Outstanding Invoice: ${notification.title}`
        description = `Invoice ${notification.invoiceNumber || notification.itemId} is outstanding and requires follow-up`
        invoiceId = notification.itemId
        priority = TodoPriority.HIGH
        break
      case "recurring_payment_due":
        title = `Recurring Payment Due: ${notification.title}`
        description = `A recurring payment is due for proposal ${notification.proposalNumber || notification.itemId}`
        proposalId = notification.itemId
        priority = TodoPriority.MEDIUM
        break
      case "installment_due":
        title = `Installment Due: ${notification.title}`
        description = `An installment payment is due for proposal ${notification.proposalNumber || notification.itemId}`
        proposalId = notification.itemId
        priority = TodoPriority.MEDIUM
        break
      default:
        title = `Action Required: ${notification.title}`
        description = "This notification requires your attention"
    }

    // Get project/client IDs if needed
    if (proposalId) {
      const proposal = await prisma.proposal.findUnique({
        where: { id: proposalId },
        select: { clientId: true },
      })
      if (proposal) {
        clientId = proposal.clientId || undefined
      }
      
      // Find project that references this proposal
      const project = await prisma.project.findFirst({
        where: { proposalId: proposalId },
        select: { id: true },
      })
      if (project) {
        projectId = project.id
      }
    }

    if (invoiceId) {
      const invoice = await prisma.bill.findUnique({
        where: { id: invoiceId },
        select: { projectId: true, clientId: true },
      })
      if (invoice) {
        projectId = invoice.projectId || undefined
        clientId = invoice.clientId || undefined
      }
    }

    // Calculate due date (default to 3 days from now if not provided)
    const dueDate = validatedData.dueDate 
      ? new Date(validatedData.dueDate)
      : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now

    // Create the todo
    const todo = await prisma.todo.create({
      data: {
        title,
        description,
        projectId,
        proposalId,
        invoiceId,
        clientId,
        assignedTo: validatedData.assignedTo || session.user.id,
        createdBy: session.user.id,
        priority,
        dueDate,
        status: "PENDING",
        isPersonal: false,
      },
      include: {
        project: true,
        proposal: true,
        invoice: true,
        client: true,
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(todo, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Error creating todo from notification:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
