export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { TodoStatus } from "@prisma/client"

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

    const todo = await prisma.todo.findUnique({
      where: { id },
    })

    if (!todo) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 })
    }

    // Assignee, creator, or admin can complete
    if (
      session.user.role !== "ADMIN" &&
      todo.assignedTo !== session.user.id &&
      todo.createdBy !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const updatedTodo = await prisma.todo.update({
      where: { id },
      data: {
        status: TodoStatus.COMPLETED,
        completedAt: new Date(),
        completedBy: session.user.id,
      },
      include: {
        assignee: true,
        creator: true,
        completer: true,
      },
    })

    return NextResponse.json(updatedTodo)
  } catch (error) {
    console.error("Error completing todo:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}






