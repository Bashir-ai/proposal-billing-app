import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { TodoStatus, TodoPriority } from "@prisma/client"
import { createTodoNotification } from "@/lib/notifications"
import { canReassignTodo, hasHigherRank } from "@/lib/permissions"

const todoUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  projectId: z.string().optional().nullable(),
  proposalId: z.string().optional().nullable(),
  proposalItemId: z.string().optional().nullable(),
  invoiceId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
  assignedTo: z.string().optional(),
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
      },
    })

    if (!todo) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 })
    }

    // Check permissions: user can view if they're assigned, creator, or admin
    // Personal todos are only visible to creator
    if (todo.isPersonal) {
      if (session.user.role !== "ADMIN" && todo.createdBy !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    } else {
      if (
        session.user.role !== "ADMIN" &&
        todo.assignedTo !== session.user.id &&
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
    })

    if (!todo) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 })
    }

    // Check permissions: user can edit if they're assigned, creator, or admin
    if (
      session.user.role !== "ADMIN" &&
      todo.assignedTo !== session.user.id &&
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
      updateData.startDate = validatedData.startDate ? new Date(validatedData.startDate) : null
    }
    if (validatedData.estimatedEndDate !== undefined) {
      updateData.estimatedEndDate = validatedData.estimatedEndDate ? new Date(validatedData.estimatedEndDate) : null
    }
    // Handle due date change - track if assignee changes it
    if (validatedData.dueDate !== undefined) {
      const newDueDate = validatedData.dueDate ? new Date(validatedData.dueDate) : null
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

    // Handle assignee change (reassignment)
    if (validatedData.assignedTo !== undefined && validatedData.assignedTo !== todo.assignedTo) {
      // Prevent reassigning personal todos
      if (todo.isPersonal || validatedData.isPersonal) {
        return NextResponse.json(
          { error: "Personal todos cannot be reassigned. They must remain assigned to the creator." },
          { status: 400 }
        )
      }
      // Check if reassignment is allowed
      if (!canReassignTodo(creator, currentAssignee, currentUser)) {
        return NextResponse.json(
          { error: "You don't have permission to reassign this todo. Only the creator (who has higher rank) or the assignee (if creator has higher rank) can reassign." },
          { status: 403 }
        )
      }

      // Validate new assignee exists
      const newAssignee = await prisma.user.findUnique({
        where: { id: validatedData.assignedTo },
      })
      if (!newAssignee) {
        return NextResponse.json(
          { error: "Assignee not found" },
          { status: 404 }
        )
      }

      // Create reassignment record
      await prisma.todoReassignment.create({
        data: {
          todoId: id,
          fromUserId: todo.assignedTo,
          toUserId: validatedData.assignedTo,
          reassignedBy: session.user.id,
          reason: validatedData.reassignmentReason || null,
        },
      })

      updateData.assignedTo = validatedData.assignedTo
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
        dueDateChanges: {
          include: {
            changedByUser: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    // Create notification if assignee changed
    if (validatedData.assignedTo && validatedData.assignedTo !== oldAssignedTo) {
      await createTodoNotification(updatedTodo.id, validatedData.assignedTo, session.user.id)
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

