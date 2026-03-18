export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { UserRole, UserProfile } from "@prisma/client"
import bcrypt from "bcryptjs"

const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.nativeEnum(UserRole).optional(),
  profile: z.nativeEnum(UserProfile).nullable().optional(),
  defaultHourlyRate: z.number().min(0).nullable().optional(),
  timezone: z.string().optional(),
  canApproveProposals: z.boolean().nullable().optional(),
  canApproveInvoices: z.boolean().nullable().optional(),
  canEditAllProposals: z.boolean().nullable().optional(),
  canEditAllInvoices: z.boolean().nullable().optional(),
  canViewAllClients: z.boolean().nullable().optional(),
  canCreateUsers: z.boolean().nullable().optional(),
})

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

    // Get current user to check permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id },
    })

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Users can only update their own profile (limited fields), or admins can update any user
    const isAdmin = currentUser.role === "ADMIN"
    const isOwnProfile = session.user.id === id

    if (!isAdmin && !isOwnProfile) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = userUpdateSchema.parse(body)

    // Build update data
    const updateData: any = {}

    // Only admins can update these fields
    if (isAdmin) {
      if (validatedData.name !== undefined) updateData.name = validatedData.name
      if (validatedData.email !== undefined) {
        // Check if email is already taken by another user
        if (validatedData.email !== targetUser.email) {
          const existingUser = await prisma.user.findUnique({
            where: { email: validatedData.email },
          })
          if (existingUser) {
            return NextResponse.json(
              { error: "Email already in use" },
              { status: 400 }
            )
          }
        }
        updateData.email = validatedData.email
      }
      if (validatedData.role !== undefined) updateData.role = validatedData.role
      if (validatedData.profile !== undefined) updateData.profile = validatedData.profile
      if (validatedData.canApproveProposals !== undefined) {
        updateData.canApproveProposals = validatedData.canApproveProposals
      }
      if (validatedData.canApproveInvoices !== undefined) {
        updateData.canApproveInvoices = validatedData.canApproveInvoices
      }
      if (validatedData.canEditAllProposals !== undefined) {
        updateData.canEditAllProposals = validatedData.canEditAllProposals
      }
      if (validatedData.canEditAllInvoices !== undefined) {
        updateData.canEditAllInvoices = validatedData.canEditAllInvoices
      }
      if (validatedData.canViewAllClients !== undefined) {
        updateData.canViewAllClients = validatedData.canViewAllClients
      }
      if (validatedData.canCreateUsers !== undefined) {
        updateData.canCreateUsers = validatedData.canCreateUsers
      }
      if (validatedData.password) {
        updateData.password = await bcrypt.hash(validatedData.password, 10)
      }
    }

    // Both admins and users can update their own hourly rate and timezone
    if (validatedData.defaultHourlyRate !== undefined) {
      updateData.defaultHourlyRate = validatedData.defaultHourlyRate
    }
    if (validatedData.timezone !== undefined) {
      updateData.timezone = validatedData.timezone
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profile: true,
        defaultHourlyRate: true,
        timezone: true,
        canApproveProposals: true,
        canApproveInvoices: true,
        canEditAllProposals: true,
        canEditAllInvoices: true,
        canViewAllClients: true,
        canCreateUsers: true,
        createdAt: true,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error updating user:", error)
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

    // Get current user to check permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Users can view their own profile, or admins can view any user
    const isAdmin = currentUser.role === "ADMIN"
    const isOwnProfile = session.user.id === id

    if (!isAdmin && !isOwnProfile) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profile: true,
        defaultHourlyRate: true,
        timezone: true,
        canApproveProposals: true,
        canApproveInvoices: true,
        canEditAllProposals: true,
        canEditAllInvoices: true,
        canViewAllClients: true,
        canCreateUsers: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error("Error fetching user:", error)
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

    // Only admins can delete users
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

    // Prevent deleting yourself
    if (session.user.id === id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      )
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id },
    })

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // If requester is bkv@vpa.pt, allow direct deletion (no approval needed)
    // Otherwise, require an approved deletion request
    if (currentUser.email !== "bkv@vpa.pt") {
      const approvedRequest = await prisma.userDeletionRequest.findFirst({
        where: {
          targetUserId: id,
          status: "APPROVED",
        },
      })

      if (!approvedRequest) {
        return NextResponse.json(
          { 
            error: "Cannot delete user. An approved deletion request is required. Please use the deletion request workflow.",
            hint: "Create a deletion request first, then get it approved by another admin.",
          },
          { status: 403 }
        )
      }
    }

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

    // Delete the user (cascade relations will be handled automatically where onDelete: Cascade is set)
    try {
      await prisma.user.delete({
        where: { id },
      })

      // If there was an approved deletion request, mark it as completed
      if (currentUser.email !== "bkv@vpa.pt") {
        const approvedRequest = await prisma.userDeletionRequest.findFirst({
          where: {
            targetUserId: id,
            status: "APPROVED",
          },
        })
        if (approvedRequest) {
          await prisma.userDeletionRequest.update({
            where: { id: approvedRequest.id },
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
            },
          })
        }
      }
    } catch (error: any) {
      // Handle foreign key constraint errors
      if (error.code === "P2003") {
        return NextResponse.json(
          { error: "Cannot delete user. User has associated records that must be removed first." },
          { status: 400 }
        )
      }
      throw error
    }

    return NextResponse.json({ message: "User deleted successfully" })
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


