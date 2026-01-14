import { prisma } from "@/lib/prisma"
import { canApproveProposals, canApproveInvoices } from "@/lib/permissions"

export interface Notification {
  type: string
  id: string
  itemId: string
  title: string
  proposalNumber?: string
  invoiceNumber?: string
  client?: {
    name: string
    company?: string | null
  } | null
  createdAt: string
}

export async function getNotifications(userId: string, userRole: string): Promise<{ count: number; notifications: Notification[] }> {
  try {
    // Fetch user with permissions
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        canApproveProposals: true,
        canApproveInvoices: true,
      },
    })

    if (!user) {
      return { count: 0, notifications: [] }
    }

    const notifications: Notification[] = []
    let count = 0

    // 1. Pending Proposal Approvals (internal)
    // First, get all submitted proposals that need approval
    const allPendingProposals = await prisma.proposal.findMany({
      where: {
        status: "SUBMITTED",
        internalApprovalRequired: true,
        internalApprovalsComplete: false,
        deletedAt: null, // Exclude deleted proposals
      },
      select: {
        id: true,
        title: true,
        proposalNumber: true,
        createdAt: true,
        requiredApproverIds: true,
        client: { select: { name: true, company: true } },
        approvals: {
          where: {
            approverId: userId,
          },
          select: {
            id: true,
            status: true,
          },
        },
      },
    })

    // Filter to only show proposals where user should see them
    const pendingProposalApprovals = allPendingProposals.filter(proposal => {
      // Check if user is specifically required to approve
      const isRequiredApprover = proposal.requiredApproverIds && proposal.requiredApproverIds.includes(userId)
      
      // Check if no specific approvers are required
      const noSpecificApprovers = !proposal.requiredApproverIds || proposal.requiredApproverIds.length === 0
      
      // Check if user has general approval permission
      const hasGeneralPermission = canApproveProposals(user)
      
      // For ADMIN/MANAGER: show all pending proposals if they have general permission
      // For others: only show if they're a required approver or no specific approvers are set
      const shouldSee = 
        (userRole === "ADMIN" || userRole === "MANAGER") && hasGeneralPermission
          ? true // Admins/Managers see all if they can approve
          : isRequiredApprover || (noSpecificApprovers && hasGeneralPermission)
      
      // Check if user hasn't already approved/rejected (PENDING approvals are OK, they can update)
      // approvals are already filtered by userId in the query
      const existingApproval = proposal.approvals[0]
      const hasNotApproved = !existingApproval || existingApproval.status === "PENDING"
      
      return shouldSee && hasNotApproved
    })

    pendingProposalApprovals.forEach(proposal => {
      notifications.push({
        type: "proposal_approval",
        id: `proposal-${proposal.id}`,
        itemId: proposal.id,
        title: proposal.title,
        proposalNumber: proposal.proposalNumber || undefined,
        client: proposal.client,
        createdAt: proposal.createdAt.toISOString(),
      })
      count++
    })

    // 2. Pending Invoice Approvals (internal)
    // First, get all submitted invoices that need approval
    const allPendingInvoices = await prisma.bill.findMany({
      where: {
        status: "SUBMITTED",
        internalApprovalRequired: true,
        internalApprovalsComplete: false,
      },
      select: {
        id: true,
        invoiceNumber: true,
        createdAt: true,
        requiredApproverIds: true,
        client: { select: { name: true, company: true } },
        approvals: {
          where: {
            approverId: userId,
          },
          select: {
            id: true,
            status: true,
          },
        },
      },
    })

    // Filter to only show invoices where user should see them
    const pendingInvoiceApprovals = allPendingInvoices.filter(bill => {
      const isRequiredApprover = bill.requiredApproverIds && bill.requiredApproverIds.includes(userId)
      const noSpecificApprovers = !bill.requiredApproverIds || bill.requiredApproverIds.length === 0
      const hasGeneralPermission = canApproveInvoices(user)
      const shouldSee = 
        (userRole === "ADMIN" || userRole === "MANAGER") && hasGeneralPermission
          ? true // Admins/Managers see all if they can approve
          : isRequiredApprover || (noSpecificApprovers && hasGeneralPermission)
      // approvals are already filtered by userId in the query
      const existingApproval = bill.approvals[0]
      const hasNotApproved = !existingApproval || existingApproval.status === "PENDING"
      return shouldSee && hasNotApproved
    })

    pendingInvoiceApprovals.forEach(bill => {
      notifications.push({
        type: "invoice_approval",
        id: `invoice-${bill.id}`,
        itemId: bill.id,
        title: `Invoice ${bill.invoiceNumber || bill.id}`,
        invoiceNumber: bill.invoiceNumber || undefined,
        client: bill.client,
        createdAt: bill.createdAt.toISOString(),
      })
      count++
    })

    // 3. Proposals pending client approval (for Admins/Managers to override)
    if (userRole === "ADMIN" || userRole === "MANAGER") {
      const fiveDaysAgo = new Date()
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)

      const proposalsPendingClientApproval = await prisma.proposal.findMany({
        where: {
          status: "APPROVED", // Internally approved
          clientApprovalStatus: "PENDING",
          clientApprovalEmailSent: true, // Only show if email was actually sent
          clientApprovalEmailSentAt: {
            not: null, // Must have a sent date
          },
        },
        include: {
          client: { select: { name: true, company: true } },
        },
        take: 20,
      })

      proposalsPendingClientApproval.forEach(proposal => {
        // Check if email was sent more than 5 days ago
        const isOverdue = proposal.clientApprovalEmailSentAt && 
                         new Date(proposal.clientApprovalEmailSentAt) < fiveDaysAgo

        notifications.push({
          type: isOverdue ? "proposal_pending_client_overdue" : "proposal_pending_client",
          id: `proposal-client-${proposal.id}`,
          itemId: proposal.id,
          title: proposal.title,
          proposalNumber: proposal.proposalNumber || undefined,
          client: proposal.client,
          createdAt: proposal.createdAt.toISOString(),
        })
        count++
      })
    }

    // 4. Todo assignments
    const unreadTodos = await prisma.todo.findMany({
      where: {
        assignedTo: userId,
        readAt: null,
        status: { not: "COMPLETED" },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        proposal: {
          select: {
            id: true,
            title: true,
            proposalNumber: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
          },
        },
        creator: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    })

    unreadTodos.forEach(todo => {
      notifications.push({
        type: "todo_assignment",
        id: `todo-${todo.id}`,
        itemId: todo.id,
        title: todo.title,
        client: todo.project?.name ? { name: todo.project.name } : undefined,
        createdAt: todo.createdAt.toISOString(),
      })
      count++
    })

    // 5. Outstanding invoices
    const outstandingInvoiceNotifications = await getOutstandingInvoiceNotifications(userId)
    outstandingInvoiceNotifications.forEach(notification => {
      notifications.push(notification)
      count++
    })

    // 6. Recurring payment notifications
    const recurringNotifications = await prisma.notification.findMany({
      where: {
        userId,
        type: "RECURRING_PAYMENT_DUE",
        readAt: null,
      },
      include: {
        proposal: {
          select: {
            id: true,
            title: true,
            proposalNumber: true,
            client: {
              select: {
                name: true,
                company: true,
              },
            },
          },
        },
        proposalItem: {
          select: {
            id: true,
            description: true,
          },
        },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    })

    recurringNotifications.forEach(notification => {
      notifications.push({
        type: "recurring_payment_due",
        id: notification.id,
        itemId: notification.proposalId || notification.proposalItemId || "",
        title: notification.title,
        proposalNumber: notification.proposal?.proposalNumber || undefined,
        client: notification.proposal?.client,
        createdAt: notification.createdAt.toISOString(),
      })
      count++
    })

    // 7. Installment due notifications
    const installmentNotifications = await prisma.notification.findMany({
      where: {
        userId,
        type: "INSTALLMENT_DUE",
        readAt: null,
      },
      include: {
        proposal: {
          select: {
            id: true,
            title: true,
            proposalNumber: true,
            client: {
              select: {
                name: true,
                company: true,
              },
            },
          },
        },
        proposalItem: {
          select: {
            id: true,
            description: true,
          },
        },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    })

    installmentNotifications.forEach(notification => {
      notifications.push({
        type: "installment_due",
        id: notification.id,
        itemId: notification.proposalId || notification.proposalItemId || "",
        title: notification.title,
        proposalNumber: notification.proposal?.proposalNumber || undefined,
        client: notification.proposal?.client,
        createdAt: notification.createdAt.toISOString(),
      })
      count++
    })

    return { count, notifications: notifications.slice(0, 20) } // Limit to 20 most recent
  } catch (error) {
    console.error("Error fetching notifications:", error)
    return { count: 0, notifications: [] }
  }
}

export async function createTodoNotification(
  todoId: string,
  assigneeId: string,
  creatorId: string
): Promise<void> {
  try {
    // Notification is created implicitly by the todo's readAt being null
    // The getNotifications function will pick it up
    // We could also create a separate Notification model if needed in the future
  } catch (error) {
    console.error("Error creating todo notification:", error)
  }
}

/**
 * Create an outstanding invoice notification
 * This is tracked via the Notification interface and shown in getNotifications
 */
export async function createOutstandingInvoiceNotification(
  billId: string,
  userId: string,
  reminderNumber: number = 0,
  isFirstTime: boolean = false
): Promise<void> {
  try {
    // Outstanding invoice notifications are handled via the getNotifications function
    // which checks for outstanding invoices and includes them in the notification list
    // This function is here for consistency and potential future use (e.g., email notifications)
  } catch (error) {
    console.error("Error creating outstanding invoice notification:", error)
  }
}

/**
 * Get outstanding invoice notifications for a user
 */
export async function getOutstandingInvoiceNotifications(userId: string): Promise<Notification[]> {
  try {
    const { prisma } = await import("@/lib/prisma")
    const { getOutstandingInvoices, isInvoiceOutstanding } = await import("@/lib/invoice-helpers")
    
    const outstandingInvoices = await getOutstandingInvoices()
    const notifications: Notification[] = []
    
    // For each outstanding invoice, check if user should be notified
    for (const invoice of outstandingInvoices) {
      const { getOutstandingInvoiceRecipients } = await import("@/lib/invoice-notifications")
      const recipients = await getOutstandingInvoiceRecipients(invoice as any)
      
      if (recipients.includes(userId)) {
        notifications.push({
          type: invoice.becameOutstandingAt && 
                invoice.lastReminderSentAt && 
                new Date(invoice.lastReminderSentAt) > new Date(invoice.becameOutstandingAt)
            ? "invoice_reminder"
            : "invoice_outstanding",
          id: `invoice-outstanding-${invoice.id}`,
          itemId: invoice.id,
          title: `Outstanding Invoice ${invoice.invoiceNumber || invoice.id}`,
          invoiceNumber: invoice.invoiceNumber || undefined,
          client: {
            name: invoice.client.name,
            company: invoice.client.company || undefined,
          },
          createdAt: invoice.becameOutstandingAt?.toISOString() || invoice.createdAt.toISOString(),
        })
      }
    }
    
    return notifications
  } catch (error) {
    console.error("Error fetching outstanding invoice notifications:", error)
    return []
  }
}

