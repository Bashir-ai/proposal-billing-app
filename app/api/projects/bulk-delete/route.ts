export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { canDeleteProject } from "@/lib/project-deletion-check"
import { isDatabaseConnectionError, getDatabaseErrorMessage } from "@/lib/database-error-handler"

const bulkDeleteSchema = z.object({
  projectIds: z.array(z.string().min(1)),
  action: z.enum(["validate", "delete"]),
  force: z.boolean().optional().default(false),
})

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { projectIds, action, force } = bulkDeleteSchema.parse(body)

    if (action === "validate") {
      if (projectIds.length > 0) {
        try {
          await canDeleteProject(projectIds[0])
        } catch (error) {
          if (isDatabaseConnectionError(error)) {
            return NextResponse.json(
              { 
                error: "Database connection error",
                message: getDatabaseErrorMessage(),
                deletable: [],
                nonDeletable: projectIds.map(id => ({
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

      const validationResults = await Promise.allSettled(
        projectIds.map(async (projectId) => {
          try {
            const deletionCheck = await canDeleteProject(projectId)
            const project = await prisma.project.findUnique({
              where: { id: projectId },
              select: { id: true, name: true },
            })

            return {
              id: projectId,
              name: project?.name || "Unknown",
              canDelete: deletionCheck.canDelete,
              reason: deletionCheck.reason,
            }
          } catch (error) {
            if (!isDatabaseConnectionError(error)) {
              console.error(`Error validating project ${projectId}:`, error)
            }
            
            return {
              id: projectId,
              name: "Unknown",
              canDelete: false,
              reason: "Unable to validate project. Database connection error.",
            }
          }
        })
      )
      
      const results = validationResults.map((result) => 
        result.status === 'fulfilled' ? result.value : {
          id: 'unknown',
          name: "Unknown",
          canDelete: false,
          reason: "Validation failed due to database error",
        }
      )

      const deletable = results
        .filter((result) => result.canDelete)
        .map((result) => ({
          id: result.id,
          name: result.name,
        }))

      const nonDeletable = results
        .filter((result) => !result.canDelete)
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
            deletable: [],
            nonDeletable: nonDeletable,
          },
          { status: 503 }
        )
      }

      return NextResponse.json({
        deletable,
        nonDeletable,
      })
    } else if (action === "delete") {
      if (force) {
        // Force delete: permanently delete all projects (hard delete)
        await prisma.$transaction(
          projectIds.map((id) =>
            prisma.project.delete({
              where: { id },
            })
          )
        )

        return NextResponse.json({
          message: `Successfully permanently deleted ${projectIds.length} project(s)`,
          deletedCount: projectIds.length,
        })
      } else {
        // Normal delete: validate and soft delete
        const validationResults = await Promise.allSettled(
          projectIds.map(async (projectId) => {
            try {
              const deletionCheck = await canDeleteProject(projectId)
              return {
                id: projectId,
                canDelete: deletionCheck.canDelete,
              }
            } catch (error) {
              console.error(`Error validating project ${projectId} for deletion:`, error)
              return {
                id: projectId,
                canDelete: false,
              }
            }
          })
        )
        
        const results = validationResults.map((result) => 
          result.status === 'fulfilled' ? result.value : {
            id: 'unknown',
            canDelete: false,
          }
        )

        const deletableIds = results
          .filter((result) => result.canDelete)
          .map((result) => result.id)
        
        const allFailed = results.every((result) => !result.canDelete && result.id === 'unknown')
        
        if (allFailed && results.length > 0) {
          return NextResponse.json(
            { 
              error: "Database connection error",
              message: "Unable to connect to the database. Please check your database connection and try again."
            },
            { status: 503 }
          )
        }

        if (deletableIds.length === 0) {
          return NextResponse.json(
            { error: "No projects can be deleted" },
            { status: 400 }
          )
        }

        const result = await prisma.$transaction(
          deletableIds.map((id) =>
            prisma.project.update({
              where: { id },
              data: {
                deletedAt: new Date(),
              },
            })
          )
        )

        return NextResponse.json({
          message: `Successfully deleted ${result.length} project(s)`,
          deletedCount: result.length,
        })
      }
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'validate' or 'delete'" },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("Error in bulk delete:", error)
    
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
