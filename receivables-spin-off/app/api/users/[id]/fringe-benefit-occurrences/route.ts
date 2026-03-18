import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { UserRole } from "@prisma/client"

export const dynamic = "force-dynamic"

const querySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const userId = id

    // user can view own; admin/manager can view all
    if (session.user.id !== userId && session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.MANAGER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.parse({
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
    })

    const where: any = {
      userId,
    }

    if (parsed.startDate) {
      where.occurrenceDate = { ...(where.occurrenceDate || {}), gte: new Date(parsed.startDate) }
    }
    if (parsed.endDate) {
      where.occurrenceDate = { ...(where.occurrenceDate || {}), lte: new Date(parsed.endDate) }
    }

    const occurrences = await prisma.fringeBenefitOccurrence.findMany({
      where,
      orderBy: { occurrenceDate: "desc" },
      include: {
        fringeBenefit: {
          select: {
            id: true,
            description: true,
            category: true,
            type: true,
          },
        },
      },
    })

    return NextResponse.json({ occurrences })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch benefit occurrences" },
      { status: 500 }
    )
  }
}

