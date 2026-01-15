export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

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

    // Only admins can create deletion requests
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true },
    })

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      )
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id },
    })

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Prevent deleting yourself
    if (session.user.id === id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      )
    }

    // If requester is bkv@vpa.pt, delete immediately (no approval needed)
    if (currentUser.email === "bkv@vpa.pt") {
      // Check for critical relations that would prevent deletion
      const [
        createdProposals,
        createdBills,
        createdClients,
        timesheetEntries,
        assignedTodos,
        managedProjects,
      ] = await Promise.all([
        prisma.proposal.count({ where: { createdBy: id } }),
        prisma.bill.count({ where: { createdBy: id } }),
        prisma.client.count({ where: { createdBy: id } }),
        prisma.timesheetEntry.count({ where: { userId: id } }),
        prisma.todo.count({ where: { assignedTo: id } }),
        prisma.projectManager.count({ where: { userId: id } }),
      ])

      if (createdProposals > 0 || createdBills > 0 || createdClients > 0 || timesheetEntries > 0 || assignedTodos > 0 || managedProjects > 0) {
        return NextResponse.json(
          { 
            error: "Cannot delete user. User has associated records (proposals, bills, clients, timesheets, todos, or projects). Please reassign or remove these records first.",
            details: {
              proposals: createdProposals,
              bills: createdBills,
              clients: createdClients,
              timesheets: timesheetEntries,
              todos: assignedTodos,
              projects: managedProjects,
            }
          },
          { status: 400 }
        )
      }

      // Delete the user directly
      try {
        await prisma.user.delete({
          where: { id },
        })
        return NextResponse.json({ message: "User deleted successfully" })
      } catch (error: any) {
        if (error.code === "P2003") {
          return NextResponse.json(
            { error: "Cannot delete user. User has associated records that must be removed first." },
            { status: 400 }
          )
        }
        throw error
      }
    }

    // For other admins, create a deletion request
    // Check if there's already a pending request
    const existingRequest = await prisma.userDeletionRequest.findFirst({
      where: {
        targetUserId: id,
        status: "PENDING",
      },
    })

    if (existingRequest) {
      return NextResponse.json(
        { 
          error: "A pending deletion request already exists for this user",
          requestId: existingRequest.id,
        },
        { status: 400 }
      )
    }

    // Create new deletion request
    const deletionRequest = await prisma.userDeletionRequest.create({
      data: {
        targetUserId: id,
        requestedBy: session.user.id,
        status: "PENDING",
        approvedBy: [],
      },
      include: {
        targetUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(deletionRequest, { status: 201 })
  } catch (error) {
    console.error("Error creating deletion request:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

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

    // Only admins can view deletion requests
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      )
    }

    // Get all deletion requests for this user
    const deletionRequests = await prisma.userDeletionRequest.findMany({
      where: {
        targetUserId: id,
      },
      include: {
        targetUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(deletionRequests)
  } catch (error) {
    console.error("Error fetching deletion requests:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
