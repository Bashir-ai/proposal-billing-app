export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { TodoStatus, TodoPriority } from "@prisma/client"
import { createTodoNotification } from "@/lib/notifications"
import { canReassignTodo, hasHigherRank } from "@/lib/permissions"
import { parseLocalDate } from "@/lib/utils"

const todoUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  projectId: z.string().optional().nullable(),
  proposalId: z.string().optional().nullable(),
  proposalItemId: z.string().optional().nullable(),
  invoiceId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
  assignedTo: z.union([z.string(), z.array(z.string())]).optional(), // Support both single and multiple assignments
  status: z.nativeEnum(TodoStatus).optional(),
  priority: z.nativeEnum(TodoPriority).optional(),
  isPersonal: z.boolean().optional(),
  startDate: z.string().optional().nullable(),
  estimatedEndDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  reassignmentReason: z.string().optional(),
  dueDateChangeReason: z.string().optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const todo = await prisma.todo.findUnique({
      where: { id },
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
        proposalItem: {
          select: {
            id: true,
            description: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            company: true,
          },
        },
        lead: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        completer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reassignments: {
          include: {
            fromUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            toUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            reassignedByUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        dueDateChanges: {
          include: {
            changedByUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    if (!todo) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 })
    }

    // Check permissions: user can view if they're assigned (via assignments or assignedTo), creator, or admin
    // Personal todos are only visible to creator
    if (todo.isPersonal) {
      if (session.user.role !== "ADMIN" && todo.createdBy !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    } else {
      const assignedUserIds = todo.assignments?.map(a => a.userId) || []
      const isAssigned = assignedUserIds.includes(session.user.id) || todo.assignedTo === session.user.id
      
      if (
        session.user.role !== "ADMIN" &&
        !isAssigned &&
        todo.createdBy !== session.user.id
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    return NextResponse.json(todo)
  } catch (error) {
    console.error("Error fetching todo:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

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

    if (session.user.role === "CLIENT") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const todo = await prisma.todo.findUnique({
      where: { id },
      include: {
        assignments: {
          select: { userId: true },
        },
      },
    })

    if (!todo) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 })
    }

    // Check permissions: user can edit if they're assigned (via assignments or assignedTo), creator, or admin
    const assignedUserIds = todo.assignments?.map(a => a.userId) || []
    const isAssigned = assignedUserIds.includes(session.user.id) || todo.assignedTo === session.user.id
    
    if (
      session.user.role !== "ADMIN" &&
      !isAssigned &&
      todo.createdBy !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = todoUpdateSchema.parse(body)

    // Fetch creator and current assignee to check permissions
    const [creator, currentAssignee] = await Promise.all([
      prisma.user.findUnique({
        where: { id: todo.createdBy },
        select: { id: true, role: true },
      }),
      prisma.user.findUnique({
        where: { id: todo.assignedTo },
        select: { id: true, role: true },
      }),
    ])

    if (!creator || !currentAssignee) {
      return NextResponse.json(
        { error: "Creator or assignee not found" },
        { status: 404 }
      )
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    })

    if (!currentUser) {
      return NextResponse.json(
        { error: "Current user not found" },
        { status: 404 }
      )
    }

    // Validate optional relations exist
    if (validatedData.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: validatedData.clientId },
      })
      if (!client) {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 }
        )
      }
    }

    if (validatedData.leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: validatedData.leadId },
      })
      if (!lead) {
        return NextResponse.json(
          { error: "Lead not found" },
          { status: 404 }
        )
      }
    }

    const updateData: any = {}
    const oldAssignedTo = todo.assignedTo

    if (validatedData.title !== undefined) updateData.title = validatedData.title
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.projectId !== undefined) updateData.projectId = validatedData.projectId
    if (validatedData.proposalId !== undefined) updateData.proposalId = validatedData.proposalId
    if (validatedData.proposalItemId !== undefined) updateData.proposalItemId = validatedData.proposalItemId
    if (validatedData.invoiceId !== undefined) updateData.invoiceId = validatedData.invoiceId
    if (validatedData.priority !== undefined) updateData.priority = validatedData.priority
    if (validatedData.isPersonal !== undefined) {
      updateData.isPersonal = validatedData.isPersonal
      // If making todo personal, ensure assignedTo matches createdBy
      if (validatedData.isPersonal) {
        updateData.assignedTo = todo.createdBy
      }
    }
    if (validatedData.startDate !== undefined) {
      updateData.startDate = validatedData.startDate ? parseLocalDate(validatedData.startDate) : null
    }
    if (validatedData.estimatedEndDate !== undefined) {
      updateData.estimatedEndDate = validatedData.estimatedEndDate ? parseLocalDate(validatedData.estimatedEndDate) : null
    }
    // Handle due date change - track if assignee changes it
    if (validatedData.dueDate !== undefined) {
      const newDueDate = validatedData.dueDate ? parseLocalDate(validatedData.dueDate) : null
      const oldDueDate = todo.dueDate
      
      // Check if due date actually changed
      const dueDateChanged = 
        (!oldDueDate && newDueDate) ||
        (oldDueDate && !newDueDate) ||
        (oldDueDate && newDueDate && oldDueDate.getTime() !== newDueDate.getTime())
      
      if (dueDateChanged && todo.assignedTo === session.user.id) {
        // Assignee is changing the due date - track it
        await prisma.todoDueDateChange.create({
          data: {
            todoId: id,
            oldDueDate: oldDueDate,
            newDueDate: newDueDate,
            changedBy: session.user.id,
            reason: validatedData.dueDateChangeReason || null,
          },
        })
      }
      
      updateData.dueDate = newDueDate
    }

    // Handle status change
    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status
      if (validatedData.status === TodoStatus.COMPLETED && todo.status !== TodoStatus.COMPLETED) {
        updateData.completedAt = new Date()
        updateData.completedBy = session.user.id
      } else if (validatedData.status !== TodoStatus.COMPLETED) {
        updateData.completedAt = null
        updateData.completedBy = null
      }
    }

    // Handle assignee change (reassignment) - support both single and multiple assignments
    if (validatedData.assignedTo !== undefined) {
      // Prevent reassigning personal todos
      if (todo.isPersonal || validatedData.isPersonal) {
        return NextResponse.json(
          { error: "Personal todos cannot be reassigned. They must remain assigned to the creator." },
          { status: 400 }
        )
      }

      // Handle multiple assignments
      let newAssigneeIds: string[] = []
      if (Array.isArray(validatedData.assignedTo)) {
        newAssigneeIds = validatedData.assignedTo
      } else if (typeof validatedData.assignedTo === 'string') {
        newAssigneeIds = [validatedData.assignedTo]
      }

      // Get current assignments
      const currentAssignments = await prisma.todoAssignment.findMany({
        where: { todoId: id },
      })
      const currentAssigneeIds = currentAssignments.map(a => a.userId)

      // Check if assignments actually changed
      const assignmentsChanged = 
        newAssigneeIds.length !== currentAssigneeIds.length ||
        !newAssigneeIds.every(id => currentAssigneeIds.includes(id))

      if (assignmentsChanged) {
        // Check if reassignment is allowed (check with primary assignee for backward compatibility)
        if (!canReassignTodo(creator, currentAssignee, currentUser)) {
          return NextResponse.json(
            { error: "You don't have permission to reassign this todo. Only the creator (who has higher rank) or the assignee (if creator has higher rank) can reassign." },
            { status: 403 }
          )
        }

        // Validate all new assignees exist
        const newAssignees = await prisma.user.findMany({
          where: { id: { in: newAssigneeIds } },
        })

        if (newAssignees.length !== newAssigneeIds.length) {
          return NextResponse.json(
            { error: "One or more assignees not found" },
            { status: 404 }
          )
        }

        // Delete existing assignments
        await prisma.todoAssignment.deleteMany({
          where: { todoId: id },
        })

        // Create new assignments
        await prisma.todoAssignment.createMany({
          data: newAssigneeIds.map(userId => ({
            todoId: id,
            userId,
            assignedBy: session.user.id,
          })),
        })

        // Update primary assignedTo for backward compatibility
        updateData.assignedTo = newAssigneeIds[0] || todo.assignedTo

        // Create reassignment records for removed assignees
        const removedAssigneeIds = currentAssigneeIds.filter(id => !newAssigneeIds.includes(id))
        for (const removedId of removedAssigneeIds) {
          if (newAssigneeIds.length > 0) {
            await prisma.todoReassignment.create({
              data: {
                todoId: id,
                fromUserId: removedId,
                toUserId: newAssigneeIds[0],
                reassignedBy: session.user.id,
                reason: validatedData.reassignmentReason || null,
              },
            })
          }
        }
      }
    }

    const updatedTodo = await prisma.todo.update({
      where: { id },
      data: updateData,
      include: {
        project: true,
        proposal: true,
        invoice: true,
        client: {
          select: {
            id: true,
            name: true,
            company: true,
          },
        },
        lead: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        completer: true,
        reassignments: {
          include: {
            fromUser: { select: { id: true, name: true, email: true } },
            toUser: { select: { id: true, name: true, email: true } },
            reassignedByUser: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        dueDateChanges: {
          include: {
            changedByUser: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    // Create notifications for new assignees
    if (validatedData.assignedTo) {
      let newAssigneeIds: string[] = []
      if (Array.isArray(validatedData.assignedTo)) {
        newAssigneeIds = validatedData.assignedTo
      } else if (typeof validatedData.assignedTo === 'string') {
        newAssigneeIds = [validatedData.assignedTo]
      }

      // Get current assignments to find new ones
      const currentAssignments = await prisma.todoAssignment.findMany({
        where: { todoId: id },
      })
      const currentAssigneeIds = currentAssignments.map(a => a.userId)
      const newAssignees = newAssigneeIds.filter(id => !currentAssigneeIds.includes(id))

      for (const assigneeId of newAssignees) {
        await createTodoNotification(updatedTodo.id, assigneeId, session.user.id)
      }
    }

    return NextResponse.json(updatedTodo)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Error updating todo:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(
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

    const todo = await prisma.todo.findUnique({
      where: { id },
      include: {
        assignments: {
          select: { userId: true },
        },
      },
    })

    if (!todo) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 })
    }

    // Check permissions: user can update if they're assigned (via assignments or assignedTo), creator, or admin
    const assignedUserIds = todo.assignments?.map(a => a.userId) || []
    const isAssigned = assignedUserIds.includes(session.user.id) || todo.assignedTo === session.user.id
    
    if (
      session.user.role !== "ADMIN" &&
      !isAssigned &&
      todo.createdBy !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      )
    }

    const updateData: any = {
      status: status as TodoStatus,
    }

    // Handle completion status
    if (status === TodoStatus.COMPLETED && todo.status !== TodoStatus.COMPLETED) {
      updateData.completedAt = new Date()
      updateData.completedBy = session.user.id
    } else if (status !== TodoStatus.COMPLETED) {
      updateData.completedAt = null
      updateData.completedBy = null
    }

    const updatedTodo = await prisma.todo.update({
      where: { id },
      data: updateData,
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(updatedTodo)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Error updating todo status:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    const todo = await prisma.todo.findUnique({
      where: { id },
    })

    if (!todo) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 })
    }

    // Check permissions: user can delete if they're creator or admin
    if (session.user.role !== "ADMIN" && todo.createdBy !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.todo.delete({
      where: { id },
    })

    return NextResponse.json({ message: "Todo deleted successfully" })
  } catch (error) {
    console.error("Error deleting todo:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

