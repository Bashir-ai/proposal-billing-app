import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"

const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.nativeEnum(UserRole).optional(),
  defaultHourlyRate: z.number().min(0).nullable().optional(),
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

    // Both admins and users can update their own hourly rate
    if (validatedData.defaultHourlyRate !== undefined) {
      updateData.defaultHourlyRate = validatedData.defaultHourlyRate
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        defaultHourlyRate: true,
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
        defaultHourlyRate: true,
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


