export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { canDeleteClient } from "@/lib/client-deletion-check"

const bulkDeleteSchema = z.object({
  clientIds: z.array(z.string().min(1)),
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
    const { clientIds, action } = bulkDeleteSchema.parse(body)

    if (action === "validate") {
      // Quick check: Try to validate the first client to detect database connection issues early
      if (clientIds.length > 0) {
        try {
          await canDeleteClient(clientIds[0])
        } catch (error) {
          // Check if it's a database connection error
          if (error && typeof error === 'object' && 'name' in error) {
            const prismaError = error as { name: string; message: string }
            if (prismaError.name === 'PrismaClientInitializationError' || 
                prismaError.message?.includes("Can't reach database server") ||
                prismaError.message?.includes("database server")) {
              // Database is unreachable - return early without processing all clients
              return NextResponse.json(
                { 
                  error: "Database connection error",
                  message: "Unable to connect to the database. Please check your database connection and try again.",
                  deletable: [],
                  nonDeletable: clientIds.map(id => ({
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
      }

      // Validate which clients can be deleted
      // Use Promise.allSettled to handle individual failures gracefully
      const validationResults = await Promise.allSettled(
        clientIds.map(async (clientId) => {
          try {
            const deletionCheck = await canDeleteClient(clientId)
            const client = await prisma.client.findUnique({
              where: { id: clientId },
              select: { id: true, name: true },
            })

            return {
              id: clientId,
              name: client?.name || "Unknown",
              canDelete: deletionCheck.canDelete,
              reason: deletionCheck.reason,
              ongoingProjects: deletionCheck.ongoingProjects,
              openInvoices: deletionCheck.openInvoices,
              openProposals: deletionCheck.openProposals,
            }
          } catch (error) {
            // If validation fails for a specific client, mark it as non-deletable
            // Only log if it's not a database connection error (to reduce noise)
            const isDbError = error && typeof error === 'object' && 'name' in error &&
              ((error as { name: string; message: string }).name === 'PrismaClientInitializationError' ||
               (error as { name: string; message: string }).message?.includes("Can't reach database server"))
            
            if (!isDbError) {
              console.error(`Error validating client ${clientId}:`, error)
            }
            
            return {
              id: clientId,
              name: "Unknown",
              canDelete: false,
              reason: "Unable to validate client. Database connection error.",
              ongoingProjects: 0,
              openInvoices: 0,
              openProposals: 0,
            }
          }
        })
      )
      
      // Extract results from Promise.allSettled
      const results = validationResults.map((result) => 
        result.status === 'fulfilled' ? result.value : {
          id: 'unknown',
          name: "Unknown",
          canDelete: false,
          reason: "Validation failed due to database error",
          ongoingProjects: 0,
          openInvoices: 0,
          openProposals: 0,
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
      
      // Check if all validations failed due to database errors
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
      // Validate again before deletion
      const validationResults = await Promise.allSettled(
        clientIds.map(async (clientId) => {
          try {
            const deletionCheck = await canDeleteClient(clientId)
            return {
              id: clientId,
              canDelete: deletionCheck.canDelete,
            }
          } catch (error) {
            console.error(`Error validating client ${clientId} for deletion:`, error)
            return {
              id: clientId,
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
      
      // Check if all validations failed
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
          { error: "No clients can be deleted" },
          { status: 400 }
        )
      }

      // Perform bulk deletion in a transaction
      const result = await prisma.$transaction(
        deletableIds.map((id) =>
          prisma.client.update({
            where: { id },
            data: {
              deletedAt: new Date(),
            },
          })
        )
      )

      return NextResponse.json({
        message: `Successfully deleted ${result.length} client(s)`,
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
    
    // Check for Prisma database connection errors
    if (error && typeof error === 'object' && 'name' in error) {
      const prismaError = error as { name: string; message: string }
      if (prismaError.name === 'PrismaClientInitializationError' || 
          prismaError.message?.includes("Can't reach database server") ||
          prismaError.message?.includes("database server")) {
        return NextResponse.json(
          { 
            error: "Database connection error", 
            message: "Unable to connect to the database. Please try again in a moment." 
          },
          { status: 503 }
        )
      }
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
