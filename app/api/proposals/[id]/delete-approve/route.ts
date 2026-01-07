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

    // Only admins can approve deletions
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      )
    }

    const proposal = await prisma.proposal.findUnique({
      where: { id },
    })

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    if (!proposal.deletionRequestedAt) {
      return NextResponse.json(
        { error: "No deletion request found for this proposal" },
        { status: 400 }
      )
    }

    await prisma.proposal.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletionApprovedAt: new Date(),
        deletionApprovedBy: session.user.id,
      },
    })

    return NextResponse.json({ message: "Deletion approved and proposal deleted" })
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}






