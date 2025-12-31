import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ProjectStatus } from "@prisma/client"

const projectSchema = z.object({
  proposalId: z.string().optional(),
  clientId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).default(ProjectStatus.ACTIVE),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const clientId = searchParams.get("clientId")

    const where: any = {}
    if (status) where.status = status
    if (clientId) where.clientId = clientId

    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            company: true,
          },
        },
        proposal: {
          select: {
            id: true,
            title: true,
            amount: true,
          },
        },
        bills: {
          select: {
            id: true,
            amount: true,
            status: true,
          },
        },
      },
    })

    return NextResponse.json(projects)
  } catch (error) {
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

    if (session.user.role === "CLIENT") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = projectSchema.parse(body)

    // If converting from proposal, verify it exists and is approved
    if (validatedData.proposalId) {
      const proposal = await prisma.proposal.findUnique({
        where: { id: validatedData.proposalId },
      })
      if (!proposal) {
        return NextResponse.json(
          { error: "Proposal not found" },
          { status: 404 }
        )
      }
      if (proposal.clientApprovalStatus !== "APPROVED") {
        return NextResponse.json(
          { error: "Proposal must be approved by client before conversion" },
          { status: 400 }
        )
      }
    }

    const project = await prisma.project.create({
      data: {
        proposalId: validatedData.proposalId || null,
        clientId: validatedData.clientId,
        name: validatedData.name,
        description: validatedData.description || null,
        status: validatedData.status,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : null,
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
      },
      include: {
        client: true,
        proposal: true,
        bills: true,
      },
    })

    return NextResponse.json(project, { status: 201 })
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

