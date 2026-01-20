export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const commentSchema = z.object({
  comment: z.string().min(1, "Comment cannot be empty"),
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

    // Verify todo exists and user has access
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

    // Check if user has access (assigned, creator, or admin)
    const assignedUserIds = todo.assignments.map(a => a.userId)
    const hasAccess = 
      session.user.role === "ADMIN" ||
      todo.createdBy === session.user.id ||
      todo.assignedTo === session.user.id ||
      assignedUserIds.includes(session.user.id)

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch comments
    const comments = await prisma.todoComment.findMany({
      where: { todoId: id },
      orderBy: { createdAt: "asc" },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(comments)
  } catch (error) {
    console.error("Error fetching todo comments:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify todo exists and user has access
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

    // Check if user has access (assigned, creator, or admin)
    const assignedUserIds = todo.assignments.map(a => a.userId)
    const hasAccess = 
      session.user.role === "ADMIN" ||
      todo.createdBy === session.user.id ||
      todo.assignedTo === session.user.id ||
      assignedUserIds.includes(session.user.id)

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = commentSchema.parse(body)

    const comment = await prisma.todoComment.create({
      data: {
        todoId: id,
        comment: validatedData.comment,
        createdBy: session.user.id,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Error creating todo comment:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
