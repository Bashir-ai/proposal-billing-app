export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { TodoStatus, TodoPriority } from "@prisma/client"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const assignedTo = searchParams.get("assignedTo")
    const createdBy = searchParams.get("createdBy")
    const projectId = searchParams.get("projectId")
    const clientId = searchParams.get("clientId")
    const status = searchParams.get("status")
    const priority = searchParams.get("priority")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const includeCompleted = searchParams.get("includeCompleted") === "true"

    const where: any = {}

    // Assigned to filter
    if (assignedTo) {
      where.assignedTo = assignedTo
    }

    // Created by filter
    if (createdBy) {
      where.createdBy = createdBy
    }

    // Project filter
    if (projectId) {
      where.projectId = projectId
    }

    // Client filter (via project)
    if (clientId) {
      where.project = { clientId }
    }

    // Status filter
    if (status) {
      where.status = status as TodoStatus
    }

    // Priority filter
    if (priority) {
      where.priority = priority as TodoPriority
    }

    // Exclude completed if not requested
    if (!includeCompleted) {
      where.status = { not: TodoStatus.COMPLETED }
    }

    // Date range filter (by due date)
    if (startDate || endDate) {
      where.dueDate = {}
      if (startDate) {
        where.dueDate.gte = new Date(startDate)
      }
      if (endDate) {
        where.dueDate.lte = new Date(endDate)
      }
    }

    // Personal todos visibility
    where.OR = [
      { isPersonal: false },
      { isPersonal: true, createdBy: session.user.id },
    ]

    const todos = await prisma.todo.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            client: {
              select: {
                id: true,
                name: true,
                company: true,
              },
            },
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
      orderBy: { dueDate: "asc" },
    })

    // Group todos by due date for timeline rendering
    const groupedByDate: Record<string, typeof todos> = {}
    todos.forEach(todo => {
      if (todo.dueDate) {
        const dateKey = todo.dueDate.toISOString().split("T")[0]
        if (!groupedByDate[dateKey]) {
          groupedByDate[dateKey] = []
        }
        groupedByDate[dateKey].push(todo)
      }
    })

    return NextResponse.json({
      todos,
      groupedByDate,
    })
  } catch (error) {
    console.error("Error fetching todo timeline data:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
