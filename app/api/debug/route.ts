import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Test database connection
    const userCount = await prisma.user.count()
    const users = await prisma.user.findMany({
      select: { email: true, role: true }
    })
    
    return NextResponse.json({
      status: "connected",
      databaseUrl: process.env.DATABASE_URL?.slice(0, 50) + "...",
      userCount,
      users: users.map(u => u.email),
      nextAuthSecret: process.env.NEXTAUTH_SECRET ? "SET" : "NOT SET"
    })
  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      message: error.message,
      databaseUrl: process.env.DATABASE_URL?.slice(0, 50) + "...",
      nextAuthSecret: process.env.NEXTAUTH_SECRET ? "SET" : "NOT SET"
    }, { status: 500 })
  }
}

