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

    const proposal = await prisma.proposal.findUnique({
      where: { id },
    })

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    // Only proposal creator or admin can request deletion
    if (proposal.createdBy !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    // If already deleted, return error
    if (proposal.deletedAt) {
      return NextResponse.json(
        { error: "Proposal is already deleted" },
        { status: 400 }
      )
    }

    // If admin, delete immediately
    if (session.user.role === "ADMIN") {
      await prisma.proposal.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletionApprovedAt: new Date(),
          deletionApprovedBy: session.user.id,
        },
      })
      return NextResponse.json({ message: "Proposal deleted successfully" })
    }

    // Otherwise, request deletion
    await prisma.proposal.update({
      where: { id },
      data: {
        deletionRequestedAt: new Date(),
        deletionRequestedBy: session.user.id,
      },
    })

    return NextResponse.json({ message: "Deletion request submitted. Waiting for admin approval." })
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


