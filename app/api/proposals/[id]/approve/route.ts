import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ClientApprovalStatus } from "@prisma/client"

const approvalSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().optional(),
})

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
      include: {
        client: true,
      },
    })

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    // Check if user is the client for this proposal
    if (session.user.role === "CLIENT") {
      const client = await prisma.client.findFirst({
        where: { email: session.user.email },
      })
      if (!client || proposal.clientId !== client.id) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        )
      }
    }

    const body = await request.json()
    const validatedData = approvalSchema.parse(body)

    const updateData: any = {
      clientApprovalStatus: validatedData.action === "approve" 
        ? ClientApprovalStatus.APPROVED 
        : ClientApprovalStatus.REJECTED,
    }

    if (validatedData.action === "approve") {
      updateData.clientApprovedAt = new Date()
      updateData.clientRejectedAt = null
      updateData.clientRejectionReason = null
    } else {
      updateData.clientRejectedAt = new Date()
      updateData.clientApprovedAt = null
      updateData.clientRejectionReason = validatedData.reason || null
    }

    const updatedProposal = await prisma.proposal.update({
      where: { id },
      data: updateData,
      include: {
        client: true,
      },
    })

    return NextResponse.json(updatedProposal)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

