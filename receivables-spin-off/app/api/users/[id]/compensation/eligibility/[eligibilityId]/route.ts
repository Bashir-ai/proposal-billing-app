export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; eligibilityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can delete eligibility records
    if (session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
    }

    const { id, eligibilityId } = await params
    const userId = id

    // Verify eligibility belongs to user
    const eligibility = await prisma.compensationEligibility.findUnique({
      where: { id: eligibilityId },
    })

    if (!eligibility) {
      return NextResponse.json({ error: "Eligibility not found" }, { status: 404 })
    }

    if (eligibility.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.compensationEligibility.delete({
      where: { id: eligibilityId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting eligibility:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete eligibility" },
      { status: 500 }
    )
  }
}
