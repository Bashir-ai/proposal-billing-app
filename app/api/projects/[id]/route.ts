export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ProjectStatus } from "@prisma/client"
import { isDatabaseConnectionError, getDatabaseErrorMessage } from "@/lib/database-error-handler"
import { parseLocalDate } from "@/lib/utils"

const projectUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  // Billing configuration fields
  useBlendedRate: z.boolean().optional().nullable(),
  blendedRate: z.number().optional().nullable(),
  hourlyRateTableType: z.enum(["FIXED_RATE", "RATE_RANGE", "HOURLY_TABLE"]).optional().nullable(),
  hourlyRateTableRates: z.any().optional().nullable(), // JSON object
  hourlyRateRangeMin: z.number().optional().nullable(),
  hourlyRateRangeMax: z.number().optional().nullable(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const project = await prisma.project.findUnique({
      where: { 
        id,
        deletedAt: null, // Exclude deleted items
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            company: true,
          },
        },
        proposal: {
          include: {
            items: true,
            milestones: true,
          },
        },
        bills: {
          include: {
            creator: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        timesheetEntries: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { date: "desc" },
        },
        charges: {
          orderBy: { createdAt: "desc" },
        },
        projectManagers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
        userRates: {
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

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Check if client can access this project
    if (session.user.role === "CLIENT") {
      const client = await prisma.client.findFirst({
        where: { 
          email: session.user.email,
          deletedAt: null, // Exclude deleted clients
        },
      })
      if (!client || project.clientId !== client.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    return NextResponse.json(project)
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const project = await prisma.project.findUnique({
      where: { id },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = projectUpdateSchema.parse(body)

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        name: validatedData.name,
        description: validatedData.description,
        status: validatedData.status,
        startDate: validatedData.startDate ? parseLocalDate(validatedData.startDate) : project.startDate,
        endDate: validatedData.endDate ? parseLocalDate(validatedData.endDate) : project.endDate,
        // Billing configuration
        useBlendedRate: validatedData.useBlendedRate !== undefined ? validatedData.useBlendedRate : project.useBlendedRate,
        blendedRate: validatedData.blendedRate !== undefined ? validatedData.blendedRate : project.blendedRate,
        hourlyRateTableType: validatedData.hourlyRateTableType !== undefined ? validatedData.hourlyRateTableType : project.hourlyRateTableType,
        hourlyRateTableRates: validatedData.hourlyRateTableRates !== undefined ? validatedData.hourlyRateTableRates : project.hourlyRateTableRates,
        hourlyRateRangeMin: validatedData.hourlyRateRangeMin !== undefined ? validatedData.hourlyRateRangeMin : project.hourlyRateRangeMin,
        hourlyRateRangeMax: validatedData.hourlyRateRangeMax !== undefined ? validatedData.hourlyRateRangeMax : project.hourlyRateRangeMax,
      },
      include: {
        client: true,
        proposal: true,
        userRates: {
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

    return NextResponse.json(updatedProject)
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admin can delete
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden. Only admins can delete projects." },
        { status: 403 }
      )
    }

    const project = await prisma.project.findUnique({
      where: { id },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Check if force deletion is requested
    const url = new URL(request.url)
    const forceDelete = url.searchParams.get("force") === "true"

    if (forceDelete) {
      // Hard delete: permanently delete the project and all related data
      // Prisma cascade will handle related records based on schema
      await prisma.project.delete({
        where: { id },
      })
      return NextResponse.json({ message: "Project permanently deleted" })
    } else {
      // Check validation before soft delete
      const { canDeleteProject } = await import("@/lib/project-deletion-check")
      const deletionCheck = await canDeleteProject(id)

      if (!deletionCheck.canDelete) {
        return NextResponse.json(
          {
            error: "Cannot delete project",
            message: deletionCheck.reason,
            activeTimesheets: deletionCheck.activeTimesheets,
            unpaidInvoices: deletionCheck.unpaidInvoices,
            isActive: deletionCheck.isActive,
          },
          { status: 400 }
        )
      }

      // Soft delete: set deletedAt timestamp
      await prisma.project.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      })

      return NextResponse.json({ message: "Project moved to junk box successfully" })
    }
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        { 
          error: "Database connection error",
          message: getDatabaseErrorMessage()
        },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

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

    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const action = body.action // "archive" or "unarchive"

    if (action === "archive") {
      await prisma.project.update({
        where: { id },
        data: {
          archivedAt: new Date(),
        },
      })
      return NextResponse.json({ message: "Project archived" })
    } else if (action === "unarchive") {
      await prisma.project.update({
        where: { id },
        data: {
          archivedAt: null,
        },
      })
      return NextResponse.json({ message: "Project unarchived" })
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'archive' or 'unarchive'" },
        { status: 400 }
      )
    }
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        { 
          error: "Database connection error",
          message: getDatabaseErrorMessage()
        },
        { status: 503 }
      )
    }
    console.error("Error archiving/unarchiving project:", error)
    if (error instanceof Error) {
      console.error("Error message:", error.message)
      console.error("Error stack:", error.stack)
    }
    return NextResponse.json(
      { error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
