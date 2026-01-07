export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const addManagersSchema = z.object({
  userIds: z.array(z.string()).min(1, "At least one user ID is required"),
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

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        projectManagers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    return NextResponse.json(project.projectManagers)
  } catch (error) {
    console.error("Error fetching project managers:", error)
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

    // Only admin and manager can add project managers
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return NextResponse.json(
        { error: "Forbidden. Only admins and managers can add project managers." },
        { status: 403 }
      )
    }

    const project = await prisma.project.findUnique({
      where: { id },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = addManagersSchema.parse(body)

    // Validate that all users exist and are not clients
    const users = await prisma.user.findMany({
      where: {
        id: { in: validatedData.userIds },
        role: { not: "CLIENT" },
      },
    })

    if (users.length !== validatedData.userIds.length) {
      return NextResponse.json(
        { error: "One or more users not found or are clients" },
        { status: 400 }
      )
    }

    // Add project managers (Prisma will handle duplicates via unique constraint)
    const createdManagers = []
    for (const userId of validatedData.userIds) {
      try {
        const manager = await prisma.projectManager.create({
          data: {
            projectId: id,
            userId,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        })
        createdManagers.push(manager)
      } catch (error: any) {
        // Skip if duplicate (unique constraint violation)
        if (error?.code !== "P2002") {
          throw error
        }
      }
    }

    return NextResponse.json(createdManagers, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Error adding project managers:", error)
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

    // Only admin and manager can remove project managers
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return NextResponse.json(
        { error: "Forbidden. Only admins and managers can remove project managers." },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json(
        { error: "userId query parameter is required" },
        { status: 400 }
      )
    }

    await prisma.projectManager.deleteMany({
      where: {
        projectId: id,
        userId,
      },
    })

    return NextResponse.json({ message: "Project manager removed successfully" })
  } catch (error) {
    console.error("Error removing project manager:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}





