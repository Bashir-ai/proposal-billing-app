export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { isDatabaseConnectionError, getDatabaseErrorMessage } from "@/lib/database-error-handler"

const bulkArchiveSchema = z.object({
  projectIds: z.array(z.string().min(1)),
  action: z.enum(["validate", "archive"]),
})

export async function POST(request: Request) {
  try {
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
    const { projectIds, action } = bulkArchiveSchema.parse(body)

    if (action === "validate") {
      // Quick check: Try to validate first project to detect database connection issues early
      if (projectIds.length > 0) {
        try {
          await prisma.project.findUnique({
            where: { id: projectIds[0] },
            select: { id: true },
          })
        } catch (error) {
          if (isDatabaseConnectionError(error)) {
            return NextResponse.json(
              { 
                error: "Database connection error",
                message: getDatabaseErrorMessage(),
                archivable: [],
                nonArchivable: projectIds.map(id => ({
                  id,
                  name: "Unknown",
                  reason: "Database connection error",
                })),
              },
              { status: 503 }
            )
          }
        }
      }

      // All projects can be archived (no validation checks needed like delete)
      // Just check if they exist and are not already archived
      const validationResults = await Promise.allSettled(
        projectIds.map(async (projectId) => {
          try {
            const project = await prisma.project.findUnique({
              where: { id: projectId },
              select: { id: true, name: true, archivedAt: true },
            })

            if (!project) {
              return {
                id: projectId,
                name: "Unknown",
                canArchive: false,
                reason: "Project not found",
              }
            }

            if (project.archivedAt !== null) {
              return {
                id: projectId,
                name: project.name || "Unknown",
                canArchive: false,
                reason: "Project is already archived",
              }
            }

            return {
              id: projectId,
              name: project.name || "Unknown",
              canArchive: true,
            }
          } catch (error) {
            if (!isDatabaseConnectionError(error)) {
              console.error(`Error validating project ${projectId}:`, error)
            }
            
            return {
              id: projectId,
              name: "Unknown",
              canArchive: false,
              reason: "Unable to validate project. Database connection error.",
            }
          }
        })
      )
      
      const results = validationResults.map((result) => 
        result.status === 'fulfilled' ? result.value : {
          id: 'unknown',
          name: "Unknown",
          canArchive: false,
          reason: "Validation failed due to database error",
        }
      )

      const archivable = results
        .filter((result) => result.canArchive)
        .map((result) => ({
          id: result.id,
          name: result.name,
        }))

      const nonArchivable = results
        .filter((result) => !result.canArchive)
        .map((result) => ({
          id: result.id,
          name: result.name,
          reason: result.reason || "Unknown reason",
        }))
      
      const allFailed = results.every((result) => 
        result.reason?.includes("Database connection error") || 
        result.reason?.includes("Unable to validate")
      )
      
      if (allFailed && results.length > 0) {
        return NextResponse.json(
          { 
            error: "Database connection error",
            message: "Unable to connect to the database. Please check your database connection and try again.",
            archivable: [],
            nonArchivable: nonArchivable,
          },
          { status: 503 }
        )
      }

      return NextResponse.json({
        archivable,
        nonArchivable,
      })
    } else if (action === "archive") {
      const validationResults = await Promise.allSettled(
        projectIds.map(async (projectId) => {
          try {
            const project = await prisma.project.findUnique({
              where: { id: projectId },
              select: { id: true, archivedAt: true },
            })

            if (!project || project.archivedAt !== null) {
              return {
                id: projectId,
                canArchive: false,
              }
            }

            return {
              id: projectId,
              canArchive: true,
            }
          } catch (error) {
            console.error(`Error validating project ${projectId} for archive:`, error)
            return {
              id: projectId,
              canArchive: false,
            }
          }
        })
      )
      
      const results = validationResults.map((result) => 
        result.status === 'fulfilled' ? result.value : {
          id: 'unknown',
          canArchive: false,
        }
      )

      const archivableIds = results
        .filter((result) => result.canArchive)
        .map((result) => result.id)
      
      const allFailed = results.every((result) => !result.canArchive && result.id === 'unknown')
      
      if (allFailed && results.length > 0) {
        return NextResponse.json(
          { 
            error: "Database connection error",
            message: "Unable to connect to the database. Please check your database connection and try again."
          },
          { status: 503 }
        )
      }

      if (archivableIds.length === 0) {
        return NextResponse.json(
          { error: "No projects can be archived" },
          { status: 400 }
        )
      }

      const result = await prisma.$transaction(
        archivableIds.map((id) =>
          prisma.project.update({
            where: { id },
            data: {
              archivedAt: new Date(),
            },
          })
        )
      )

      return NextResponse.json({
        message: `Successfully archived ${result.length} project(s)`,
        archivedCount: result.length,
      })
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'validate' or 'archive'" },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("Error in bulk archive:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }
    
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
      { 
        error: "Internal server error", 
        message: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    )
  }
}
