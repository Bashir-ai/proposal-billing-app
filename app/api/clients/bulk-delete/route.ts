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
      // Validate which clients can be deleted
      const validationResults = await Promise.all(
        clientIds.map(async (clientId) => {
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
        })
      )

      const deletable = validationResults
        .filter((result) => result.canDelete)
        .map((result) => ({
          id: result.id,
          name: result.name,
        }))

      const nonDeletable = validationResults
        .filter((result) => !result.canDelete)
        .map((result) => ({
          id: result.id,
          name: result.name,
          reason: result.reason || "Unknown reason",
        }))

      return NextResponse.json({
        deletable,
        nonDeletable,
      })
    } else if (action === "delete") {
      // Validate again before deletion
      const validationResults = await Promise.all(
        clientIds.map(async (clientId) => {
          const deletionCheck = await canDeleteClient(clientId)
          return {
            id: clientId,
            canDelete: deletionCheck.canDelete,
          }
        })
      )

      const deletableIds = validationResults
        .filter((result) => result.canDelete)
        .map((result) => result.id)

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
