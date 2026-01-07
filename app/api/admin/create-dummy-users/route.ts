import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only allow admins to create dummy users
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const users = [
      {
        name: "MAT",
        email: "mat@test.com",
        password: "test123",
        role: "STAFF" as const,
        defaultHourlyRate: 150,
      },
      {
        name: "SDF",
        email: "sdf@test.com",
        password: "test123",
        role: "STAFF" as const,
        defaultHourlyRate: 175,
      },
      {
        name: "VHP",
        email: "vhp@test.com",
        password: "test123",
        role: "STAFF" as const,
        defaultHourlyRate: 200,
      },
    ]

    const createdUsers = []
    const skippedUsers = []

    for (const userData of users) {
      try {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: userData.email },
        })

        if (existingUser) {
          skippedUsers.push({
            name: userData.name,
            email: userData.email,
            reason: "User already exists",
          })
          continue
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 10)

        // Create user
        const user = await prisma.user.create({
          data: {
            name: userData.name,
            email: userData.email,
            password: hashedPassword,
            role: userData.role,
            defaultHourlyRate: userData.defaultHourlyRate,
          },
        })

        createdUsers.push({
          id: user.id,
          name: user.name,
          email: user.email,
        })
      } catch (error: any) {
        skippedUsers.push({
          name: userData.name,
          email: userData.email,
          reason: error.message,
        })
      }
    }

    return NextResponse.json({
      message: "Dummy users creation completed",
      created: createdUsers,
      skipped: skippedUsers,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}






