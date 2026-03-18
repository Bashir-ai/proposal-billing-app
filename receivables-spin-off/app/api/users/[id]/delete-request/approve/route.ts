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

    // Only admins can approve deletion requests
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

    // Find the pending deletion request
    const deletionRequest = await prisma.userDeletionRequest.findFirst({
      where: {
        targetUserId: id,
        status: "PENDING",
      },
      include: {
        targetUser: true,
        requester: true,
      },
    })

    if (!deletionRequest) {
      return NextResponse.json(
        { error: "No pending deletion request found for this user" },
        { status: 404 }
      )
    }

    // Cannot approve own deletion request
    if (deletionRequest.requestedBy === session.user.id) {
      return NextResponse.json(
        { error: "Cannot approve your own deletion request" },
        { status: 400 }
      )
    }

    // Check if already approved by this user
    if (deletionRequest.approvedBy.includes(session.user.id)) {
      return NextResponse.json(
        { error: "You have already approved this deletion request" },
        { status: 400 }
      )
    }

    // Add approver to the list
    const updatedApprovedBy = [...deletionRequest.approvedBy, session.user.id]

    // Check if we have 2 approvals
    if (updatedApprovedBy.length >= 2) {
      // Update status to APPROVED and proceed with deletion
      await prisma.userDeletionRequest.update({
        where: { id: deletionRequest.id },
        data: {
          status: "APPROVED",
          approvedBy: updatedApprovedBy,
        },
      })

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
        // Update status to REJECTED
        await prisma.userDeletionRequest.update({
          where: { id: deletionRequest.id },
          data: {
            status: "REJECTED",
          },
        })
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

      // Delete the user
      try {
        await prisma.user.delete({
          where: { id },
        })

        // Update deletion request status to COMPLETED
        await prisma.userDeletionRequest.update({
          where: { id: deletionRequest.id },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        })

        return NextResponse.json({ message: "User deleted successfully" })
      } catch (error: any) {
        // Update status to REJECTED if deletion fails
        await prisma.userDeletionRequest.update({
          where: { id: deletionRequest.id },
          data: {
            status: "REJECTED",
          },
        })
        if (error.code === "P2003") {
          return NextResponse.json(
            { error: "Cannot delete user. User has associated records that must be removed first." },
            { status: 400 }
          )
        }
        throw error
      }
    } else {
      // Update with new approver but keep status as PENDING
      const updatedRequest = await prisma.userDeletionRequest.update({
        where: { id: deletionRequest.id },
        data: {
          approvedBy: updatedApprovedBy,
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

      return NextResponse.json({
        ...updatedRequest,
        approvalCount: updatedApprovedBy.length,
        requiredApprovals: 2,
      })
    }
  } catch (error) {
    console.error("Error approving deletion request:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
