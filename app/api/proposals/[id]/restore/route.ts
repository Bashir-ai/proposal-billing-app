export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

    // Only admin can restore
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden. Only admins can restore proposals." },
        { status: 403 }
      )
    }

    const proposal = await prisma.proposal.findUnique({
      where: { id },
    })

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    if (!proposal.deletedAt) {
      return NextResponse.json(
        { error: "Proposal is not deleted" },
        { status: 400 }
      )
    }

    // Restore: set deletedAt to null
    await prisma.proposal.update({
      where: { id },
      data: {
        deletedAt: null,
      },
    })

    return NextResponse.json({ message: "Proposal restored successfully" })
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}





