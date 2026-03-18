export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ProjectStatus } from "@prisma/client"
import { parseLocalDate } from "@/lib/utils"

const projectSchema = z.object({
  proposalId: z.string().optional(),
  clientId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).default(ProjectStatus.ACTIVE),
  currency: z.string().optional(),
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
    const tagId = searchParams.get("tagId")
    const name = searchParams.get("name")
    const responsiblePersonId = searchParams.get("responsiblePersonId")
    const projectManagerId = searchParams.get("projectManagerId")
    const includeArchived = searchParams.get("includeArchived") === "true"

    const where: any = {
      deletedAt: null, // Exclude deleted items
    }
    // Only exclude archived items if includeArchived is not true
    if (!includeArchived) {
      where.archivedAt = null
    }
    if (status) {
      // Support comma-separated status values
      const statuses = status.split(",").map(s => s.trim())
      if (statuses.length === 1) {
        where.status = statuses[0]
      } else {
        where.status = { in: statuses }
      }
    }
    if (clientId) where.clientId = clientId
    if (name) {
      where.name = {
        contains: name,
        mode: "insensitive",
      }
    }
    
    // Handle proposal-related filters
    if (tagId || responsiblePersonId) {
      const proposalWhere: any = {}
      if (tagId) {
        proposalWhere.tags = {
          some: {
            id: tagId,
          },
        }
      }
      if (responsiblePersonId) {
        proposalWhere.createdBy = responsiblePersonId
      }
      // Only include projects that have proposals matching the criteria
      where.proposal = proposalWhere
    }

    // Handle project manager filter
    if (projectManagerId) {
      where.projectManagers = {
        some: {
          userId: projectManagerId,
        },
      }
    }

    // For EXTERNAL users, only show projects they're assigned to
    if (session.user.role === "EXTERNAL") {
      where.projectManagers = {
        some: {
          userId: session.user.id,
        },
      }
    }

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
            type: true,
            createdBy: true,
            blendedRate: true,
            useBlendedRate: true,
            hourlyRateRangeMin: true,
            hourlyRateRangeMax: true,
            hourlyRateTableRates: true,
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            tags: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
            items: {
              select: {
                id: true,
                personId: true,
                rate: true,
                billingMethod: true,
              },
            },
          },
        },
        bills: {
          select: {
            id: true,
            amount: true,
            status: true,
          },
        },
        projectManagers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error("Error fetching projects:", error)
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

    if (session.user.role === "CLIENT" || session.user.role === "EXTERNAL") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = projectSchema.parse(body)

    // If converting from proposal, verify it exists and is approved
    let proposalCurrency = "EUR" // Default currency
    if (validatedData.proposalId) {
      const proposal = await prisma.proposal.findUnique({
        where: { id: validatedData.proposalId },
        include: {
          projects: true,
        },
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
      // Check if project already exists for this proposal
      if (proposal.projects.length > 0) {
        return NextResponse.json(
          { error: "A project already exists for this proposal" },
          { status: 400 }
        )
      }
      // Inherit currency from proposal
      proposalCurrency = proposal.currency || "EUR"
    }

    const project = await prisma.project.create({
      data: {
        proposalId: validatedData.proposalId || null,
        clientId: validatedData.clientId,
        name: validatedData.name,
        description: validatedData.description || null,
        status: validatedData.status,
        currency: validatedData.currency || proposalCurrency,
        startDate: validatedData.startDate ? parseLocalDate(validatedData.startDate) : null,
        endDate: validatedData.endDate ? parseLocalDate(validatedData.endDate) : null,
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


