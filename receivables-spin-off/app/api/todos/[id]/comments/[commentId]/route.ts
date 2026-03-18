export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const commentUpdateSchema = z.object({
  comment: z.string().min(1, "Comment cannot be empty"),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id, commentId } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify comment exists
    const comment = await prisma.todoComment.findUnique({
      where: { id: commentId },
      include: {
        todo: {
          include: {
            assignments: {
              select: { userId: true },
            },
          },
        },
      },
    })

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    // Verify comment belongs to the todo
    if (comment.todoId !== id) {
      return NextResponse.json({ error: "Comment does not belong to this todo" }, { status: 400 })
    }

    // Check permissions: only creator or admin can edit
    if (comment.createdBy !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = commentUpdateSchema.parse(body)

    const updatedComment = await prisma.todoComment.update({
      where: { id: commentId },
      data: {
        comment: validatedData.comment,
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

    return NextResponse.json(updatedComment)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Error updating todo comment:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id, commentId } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify comment exists
    const comment = await prisma.todoComment.findUnique({
      where: { id: commentId },
    })

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    // Verify comment belongs to the todo
    if (comment.todoId !== id) {
      return NextResponse.json({ error: "Comment does not belong to this todo" }, { status: 400 })
    }

    // Check permissions: only creator or admin can delete
    if (comment.createdBy !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.todoComment.delete({
      where: { id: commentId },
    })

    return NextResponse.json({ message: "Comment deleted" })
  } catch (error) {
    console.error("Error deleting todo comment:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
