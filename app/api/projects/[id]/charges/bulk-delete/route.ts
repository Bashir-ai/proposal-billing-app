export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { isDatabaseConnectionError, getDatabaseErrorMessage } from "@/lib/database-error-handler"

const bulkDeleteSchema = z.object({
  chargeIds: z.array(z.string().min(1)),
})

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

    // Only ADMIN can bulk delete charges
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden. Only admins can bulk delete charges." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { chargeIds } = bulkDeleteSchema.parse(body)

    // Verify all charges exist and belong to this project
    const charges = await prisma.projectCharge.findMany({
      where: {
        id: { in: chargeIds },
        projectId: id,
      },
      select: {
        id: true,
      },
    })

    if (charges.length !== chargeIds.length) {
      return NextResponse.json(
        { error: "Some charges not found or do not belong to this project" },
        { status: 404 }
      )
    }

    // Delete all charges in a transaction
    await prisma.$transaction(
      chargeIds.map((chargeId) =>
        prisma.projectCharge.delete({
          where: { id: chargeId },
        })
      )
    )

    return NextResponse.json({
      message: `Successfully deleted ${chargeIds.length} charge(s)`,
      deletedCount: chargeIds.length,
    })
  } catch (error) {
    console.error("Error in bulk delete charges:", error)

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
