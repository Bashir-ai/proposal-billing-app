import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isDatabaseConnectionError, getDatabaseErrorMessage } from "@/lib/database-error-handler"

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admin can empty junk box
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden. Only admins can empty the junk box." },
        { status: 403 }
      )
    }

    // Check database connection first
    try {
      await prisma.$queryRaw`SELECT 1`
    } catch (dbError) {
      if (isDatabaseConnectionError(dbError)) {
        return NextResponse.json(
          { 
            error: "Database connection error",
            message: getDatabaseErrorMessage()
          },
          { status: 503 }
        )
      }
      throw dbError
    }

    // Count items before deletion for response
    const [proposalCount, projectCount, billCount] = await Promise.all([
      prisma.proposal.count({
        where: {
          deletedAt: { not: null },
        },
      }),
      prisma.project.count({
        where: {
          deletedAt: { not: null },
        },
      }),
      prisma.bill.count({
        where: {
          deletedAt: { not: null },
        },
      }),
    ])

    // Permanently delete all soft-deleted items in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete proposals
      await tx.proposal.deleteMany({
        where: {
          deletedAt: { not: null },
        },
      })

      // Delete projects
      await tx.project.deleteMany({
        where: {
          deletedAt: { not: null },
        },
      })

      // Delete bills
      await tx.bill.deleteMany({
        where: {
          deletedAt: { not: null },
        },
      })
    })

    return NextResponse.json({
      message: `Successfully emptied junk box. Permanently deleted ${proposalCount} proposal(s), ${projectCount} project(s), and ${billCount} invoice(s).`,
      deletedCounts: {
        proposals: proposalCount,
        projects: projectCount,
        bills: billCount,
      },
    })
  } catch (error) {
    console.error("Error emptying junk box:", error)
    
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
