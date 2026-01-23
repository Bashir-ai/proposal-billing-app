export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { TodoStatus, TodoPriority } from "@prisma/client"
import { createTodoNotification } from "@/lib/notifications"
import { parseLocalDate } from "@/lib/utils"

const todoSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  projectId: z.string().optional(),
  proposalId: z.string().optional(),
  proposalItemId: z.string().optional(),
  invoiceId: z.string().optional(),
  clientId: z.string().optional(),
  leadId: z.string().optional(),
  assignedTo: z.union([z.string(), z.array(z.string())]).optional(), // Support both single and multiple assignments
  priority: z.nativeEnum(TodoPriority).default(TodoPriority.MEDIUM),
  isPersonal: z.boolean().default(false),
  startDate: z.string().optional(),
  estimatedEndDate: z.string().optional(),
  dueDate: z.string().optional(),
})

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")
    const proposalId = searchParams.get("proposalId")
    const invoiceId = searchParams.get("invoiceId")
    const clientId = searchParams.get("clientId")
    const leadId = searchParams.get("leadId")
    const assignedTo = searchParams.get("assignedTo")
    const createdBy = searchParams.get("createdBy")
    const status = searchParams.get("status")
    const priority = searchParams.get("priority")
    const read = searchParams.get("read") // "true" or "false"
    const hidePersonal = searchParams.get("hidePersonal") === "true"
    const deadlineFilter = searchParams.get("deadlineFilter") // "late", "approaching", "in_time"
    
    // Pagination parameters
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "100")
    const skip = (page - 1) * limit

    const where: any = {}

    // Handle personal todos visibility - by default show all, allow hiding personal todos
    if (session.user.role === "ADMIN") {
      // Admins can see all todos by default
      if (hidePersonal) {
        // Hide personal todos if requested
        where.isPersonal = false
      }
      // Otherwise show all (no filter)
      
      // Apply assignedTo filter if provided (check both assignedTo and assignments)
      if (assignedTo) {
        if (hidePersonal) {
          where.OR = [
            { assignedTo: assignedTo, isPersonal: false },
            { assignments: { some: { userId: assignedTo } }, isPersonal: false },
          ]
        } else {
          where.OR = [
            { assignedTo: assignedTo },
            { assignments: { some: { userId: assignedTo } } },
          ]
        }
      }
    } else {
      // Non-admins: can see their assigned todos, todos they created, or their own personal todos
      // By default, show all (assigned + created + own personal)
      
      // Non-admins can only filter their own assigned todos
      if (assignedTo && assignedTo !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      
      // If assignedTo filter is provided, show only that user's assigned todos
      // If no filter provided, show todos assigned to user OR todos created by user
      if (assignedTo) {
        // Filter by specific assignee (must be the current user)
        const targetUserId = assignedTo
        if (hidePersonal) {
          // Hide personal todos - only show assigned non-personal todos (check both assignedTo and assignments)
          where.OR = [
            { assignedTo: targetUserId, isPersonal: false },
            { assignments: { some: { userId: targetUserId } }, isPersonal: false },
          ]
        } else {
          // Show assigned todos OR own personal todos (check both assignedTo and assignments)
          where.OR = [
            { assignedTo: targetUserId, isPersonal: false },
            { assignments: { some: { userId: targetUserId } }, isPersonal: false },
            { assignedTo: targetUserId, createdBy: session.user.id, isPersonal: true },
          ]
        }
      } else {
        // No assignedTo filter: show todos assigned to user OR todos created by user
        if (hidePersonal) {
          // Hide personal todos - show assigned non-personal todos OR created non-personal todos
          where.OR = [
            { assignedTo: session.user.id, isPersonal: false },
            { assignments: { some: { userId: session.user.id } }, isPersonal: false },
            { createdBy: session.user.id, isPersonal: false },
          ]
        } else {
          // Show assigned todos OR created todos OR own personal todos
          where.OR = [
            { assignedTo: session.user.id, isPersonal: false },
            { assignments: { some: { userId: session.user.id } }, isPersonal: false },
            { createdBy: session.user.id, isPersonal: false },
            { createdBy: session.user.id, isPersonal: true },
          ]
        }
      }
    }

    // Apply additional filters
    if (projectId) {
      if (where.OR) {
        where.OR = where.OR.map((condition: any) => ({ ...condition, projectId }))
      } else {
        where.projectId = projectId
      }
    }
    if (proposalId) {
      if (where.OR) {
        where.OR = where.OR.map((condition: any) => ({ ...condition, proposalId }))
      } else {
        where.proposalId = proposalId
      }
    }
    if (invoiceId) {
      if (where.OR) {
        where.OR = where.OR.map((condition: any) => ({ ...condition, invoiceId }))
      } else {
        where.invoiceId = invoiceId
      }
    }
    if (clientId) {
      if (where.OR) {
        where.OR = where.OR.map((condition: any) => ({ ...condition, clientId }))
      } else {
        where.clientId = clientId
      }
    }
    if (leadId) {
      if (where.OR) {
        where.OR = where.OR.map((condition: any) => ({ ...condition, leadId }))
      } else {
        where.leadId = leadId
      }
    }
    if (createdBy) {
      // For personal todos, createdBy must match the current user
      // So if filtering by createdBy and it's not the current user, exclude personal todos
      if (where.OR) {
        if (createdBy === session.user.id) {
          // User is filtering by their own created todos - include personal todos
          where.OR = where.OR.map((condition: any) => ({ ...condition, createdBy }))
        } else {
          // User is filtering by someone else - exclude personal todos
          where.OR = where.OR
            .filter((condition: any) => !condition.isPersonal)
            .map((condition: any) => ({ ...condition, createdBy }))
        }
      } else {
        where.createdBy = createdBy
        // If filtering by someone else's created todos, exclude personal ones
        if (createdBy !== session.user.id) {
          where.isPersonal = false
        }
      }
    }
    if (status) {
      if (where.OR) {
        where.OR = where.OR.map((condition: any) => ({ ...condition, status }))
      } else {
        where.status = status
      }
    }
    if (priority) {
      if (where.OR) {
        where.OR = where.OR.map((condition: any) => ({ ...condition, priority }))
      } else {
        where.priority = priority
      }
    }
    if (read === "true") {
      if (where.OR) {
        where.OR = where.OR.map((condition: any) => ({ ...condition, readAt: { not: null } }))
      } else {
        where.readAt = { not: null }
      }
    }
    if (read === "false") {
      if (where.OR) {
        where.OR = where.OR.map((condition: any) => ({ ...condition, readAt: null }))
      } else {
        where.readAt = null
      }
    }

    // Handle deadline filter (late, approaching, in_time)
    if (deadlineFilter && deadlineFilter !== "") {
      const now = new Date()
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
      
      if (deadlineFilter === "late") {
        // Due date is in the past and not completed
        const deadlineCondition = {
          dueDate: { lt: now },
          status: { not: "COMPLETED" },
        }
        if (where.OR) {
          // Apply to each OR branch
          where.AND = [
            {
              OR: where.OR.map((condition: any) => ({
                ...condition,
                ...deadlineCondition,
              })),
            },
          ]
          delete where.OR
        } else {
          if (where.AND) {
            where.AND.push(deadlineCondition)
          } else {
            Object.assign(where, deadlineCondition)
          }
        }
      } else if (deadlineFilter === "approaching") {
        // Due date is within 3 days and not completed
        const deadlineCondition = {
          dueDate: { gte: now, lte: threeDaysFromNow },
          status: { not: "COMPLETED" },
        }
        if (where.OR) {
          where.AND = [
            {
              OR: where.OR.map((condition: any) => ({
                ...condition,
                ...deadlineCondition,
              })),
            },
          ]
          delete where.OR
        } else {
          if (where.AND) {
            where.AND.push(deadlineCondition)
          } else {
            Object.assign(where, deadlineCondition)
          }
        }
      } else if (deadlineFilter === "in_time") {
        // Due date is more than 3 days away OR completed OR no due date
        const deadlineCondition = {
          OR: [
            { dueDate: { gt: threeDaysFromNow } },
            { dueDate: null },
            { status: "COMPLETED" },
          ],
        }
        if (where.OR) {
          // Combine: (user's todos) AND (deadline condition)
          where.AND = [
            { OR: where.OR },
            deadlineCondition,
          ]
          delete where.OR
        } else {
          if (where.AND) {
            where.AND.push(deadlineCondition)
          } else {
            Object.assign(where, deadlineCondition)
          }
        }
      }
    }

    // Debug logging
    // Debug logging removed for production
    
    const [todos, total] = await Promise.all([
      prisma.todo.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { priority: "desc" },
          { dueDate: "asc" },
          { createdAt: "desc" },
        ],
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
          completer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
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
      }),
      prisma.todo.count({ where })
    ])

    // Debug logging removed for production
    return NextResponse.json({
      data: todos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching todos:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
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

    const body = await request.json()
    const validatedData = todoSchema.parse(body)

    // Handle multiple assignments
    let assigneeIds: string[] = []
    if (Array.isArray(validatedData.assignedTo)) {
      assigneeIds = validatedData.assignedTo
    } else if (typeof validatedData.assignedTo === 'string') {
      assigneeIds = [validatedData.assignedTo]
    } else {
      assigneeIds = [session.user.id]
    }

    // If personal todo, automatically assign to creator only
    if (validatedData.isPersonal) {
      assigneeIds = [session.user.id]
    }

    // Validate that all assignees exist
    const assignees = await prisma.user.findMany({
      where: { id: { in: assigneeIds } },
    })

    if (assignees.length !== assigneeIds.length) {
      return NextResponse.json(
        { error: "One or more assignees not found" },
        { status: 404 }
      )
    }

    // Personal todos must be assigned to creator only
    if (validatedData.isPersonal && (assigneeIds.length !== 1 || assigneeIds[0] !== session.user.id)) {
      return NextResponse.json(
        { error: "Personal todos must be assigned to the creator only" },
        { status: 400 }
      )
    }

    // Use first assignee for backward compatibility with assignedTo field
    const primaryAssigneeId = assigneeIds[0] || session.user.id

    // Validate optional relations exist
    if (validatedData.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: validatedData.projectId },
      })
      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        )
      }
    }

    if (validatedData.proposalId) {
      const proposal = await prisma.proposal.findUnique({
        where: { id: validatedData.proposalId },
      })
      if (!proposal) {
        return NextResponse.json(
          { error: "Proposal not found" },
          { status: 404 }
        )
      }
    }

    if (validatedData.invoiceId) {
      const invoice = await prisma.bill.findUnique({
        where: { id: validatedData.invoiceId },
      })
      if (!invoice) {
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 }
        )
      }
    }

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

    const todo = await prisma.todo.create({
      data: {
        title: validatedData.title,
        description: validatedData.description || null,
        projectId: validatedData.projectId || null,
        proposalId: validatedData.proposalId || null,
        proposalItemId: validatedData.proposalItemId || null,
        invoiceId: validatedData.invoiceId || null,
        clientId: validatedData.clientId || null,
        leadId: validatedData.leadId || null,
        assignedTo: primaryAssigneeId,
        createdBy: session.user.id,
        priority: validatedData.priority,
        isPersonal: validatedData.isPersonal || false,
        startDate: validatedData.startDate ? parseLocalDate(validatedData.startDate) : null,
        estimatedEndDate: validatedData.estimatedEndDate ? parseLocalDate(validatedData.estimatedEndDate) : null,
        dueDate: validatedData.dueDate ? parseLocalDate(validatedData.dueDate) : null,
      },
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
        assignee: true,
        creator: true,
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

    // Create notifications for all assignees (only for non-personal todos)
    if (!validatedData.isPersonal) {
      for (const assigneeId of assigneeIds) {
        await createTodoNotification(todo.id, assigneeId, session.user.id)
      }
    }

    return NextResponse.json(todo, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Error creating todo:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

