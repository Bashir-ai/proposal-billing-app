export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  const newRole = searchParams.get('role')
  
  try {
    if (email && newRole) {
      // Update user role
      const updated = await prisma.user.update({
        where: { email },
        data: { role: newRole as any },
        select: { email: true, role: true, name: true }
      })
      return NextResponse.json({ 
        action: "updated",
        user: updated 
      })
    }
    
    // Show all users with their roles
    const users = await prisma.user.findMany({
      select: { email: true, role: true, name: true }
    })
    
    return NextResponse.json({ 
      users,
      usage: "Add ?email=user@example.com&role=ADMIN to update a user's role"
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}


