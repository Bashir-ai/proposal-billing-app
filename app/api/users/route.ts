import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"
import { canCreateUsers } from "@/lib/permissions"

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.nativeEnum(UserRole),
  canApproveProposals: z.boolean().nullable().optional(),
  canApproveInvoices: z.boolean().nullable().optional(),
  canEditAllProposals: z.boolean().nullable().optional(),
  canEditAllInvoices: z.boolean().nullable().optional(),
  canViewAllClients: z.boolean().nullable().optional(),
  canCreateUsers: z.boolean().nullable().optional(),
})

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only staff members can see other users
    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const users = await prisma.user.findMany({
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
      orderBy: {
        name: "asc",
      },
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error("Error fetching users:", error)
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

    // Check if user can create users
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        canCreateUsers: true,
      },
    })

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (!canCreateUsers(currentUser)) {
      return NextResponse.json(
        { error: "Forbidden: You don't have permission to create users" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = createUserSchema.parse(body)

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: validatedData.role,
        canApproveProposals: validatedData.canApproveProposals ?? null,
        canApproveInvoices: validatedData.canApproveInvoices ?? null,
        canEditAllProposals: validatedData.canEditAllProposals ?? null,
        canEditAllInvoices: validatedData.canEditAllInvoices ?? null,
        canViewAllClients: validatedData.canViewAllClients ?? null,
        canCreateUsers: validatedData.canCreateUsers ?? null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        canApproveProposals: true,
        canApproveInvoices: true,
        canEditAllProposals: true,
        canEditAllInvoices: true,
        canViewAllClients: true,
        canCreateUsers: true,
        createdAt: true,
      },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error creating user:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

