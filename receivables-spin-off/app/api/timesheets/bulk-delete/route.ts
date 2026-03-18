export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { isDatabaseConnectionError, getDatabaseErrorMessage } from "@/lib/database-error-handler"

const bulkDeleteSchema = z.object({
  entryIds: z.array(z.string().min(1)),
})

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only ADMIN can bulk delete timesheet entries
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden. Only admins can bulk delete timesheet entries." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { entryIds } = bulkDeleteSchema.parse(body)

    // Verify all entries exist and get their project IDs
    const entries = await prisma.timesheetEntry.findMany({
      where: {
        id: { in: entryIds },
      },
      select: {
        id: true,
        projectId: true,
        billed: true,
      },
    })

    if (entries.length !== entryIds.length) {
      return NextResponse.json(
        { error: "Some timesheet entries not found" },
        { status: 404 }
      )
    }

    // Delete all entries in a transaction
    await prisma.$transaction(
      entryIds.map((entryId) =>
        prisma.timesheetEntry.delete({
          where: { id: entryId },
        })
      )
    )

    return NextResponse.json({
      message: `Successfully deleted ${entryIds.length} timesheet entry/entries`,
      deletedCount: entryIds.length,
    })
  } catch (error) {
    console.error("Error in bulk delete timesheet entries:", error)

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
