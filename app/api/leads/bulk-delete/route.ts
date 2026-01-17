export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { canDeleteLead } from "@/lib/lead-deletion-check"
import { isDatabaseConnectionError, getDatabaseErrorMessage } from "@/lib/database-error-handler"

const bulkDeleteSchema = z.object({
  leadIds: z.array(z.string().min(1)),
  action: z.enum(["validate", "delete"]),
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
    const { leadIds, action } = bulkDeleteSchema.parse(body)

    if (action === "validate") {
      if (leadIds.length > 0) {
        try {
          await canDeleteLead(leadIds[0])
        } catch (error) {
          if (isDatabaseConnectionError(error)) {
            return NextResponse.json(
              { 
                error: "Database connection error",
                message: getDatabaseErrorMessage(),
                deletable: [],
                nonDeletable: leadIds.map(id => ({
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
        leadIds.map(async (leadId) => {
          try {
            const deletionCheck = await canDeleteLead(leadId)
            const lead = await prisma.lead.findUnique({
              where: { id: leadId },
              select: { id: true, name: true },
            })

            return {
              id: leadId,
              name: lead?.name || "Unknown",
              canDelete: deletionCheck.canDelete,
              reason: deletionCheck.reason,
            }
          } catch (error) {
            if (!isDatabaseConnectionError(error)) {
              console.error(`Error validating lead ${leadId}:`, error)
            }
            
            return {
              id: leadId,
              name: "Unknown",
              canDelete: false,
              reason: "Unable to validate lead. Database connection error.",
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
      const validationResults = await Promise.allSettled(
        leadIds.map(async (leadId) => {
          try {
            const deletionCheck = await canDeleteLead(leadId)
            return {
              id: leadId,
              canDelete: deletionCheck.canDelete,
            }
          } catch (error) {
            console.error(`Error validating lead ${leadId} for deletion:`, error)
            return {
              id: leadId,
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
          { error: "No leads can be deleted" },
          { status: 400 }
        )
      }

      const result = await prisma.$transaction(
        deletableIds.map((id) =>
          prisma.lead.update({
            where: { id },
            data: {
              deletedAt: new Date(),
            },
          })
        )
      )

      return NextResponse.json({
        message: `Successfully deleted ${result.length} lead(s)`,
        deletedCount: result.length,
      })
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
