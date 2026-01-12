export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { UserRole, AdvanceType, AdvanceFrequency } from "@prisma/client"

const updateAdvanceSchema = z.object({
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  currency: z.string().optional(),
  startDate: z.string().transform((str) => new Date(str)).optional(),
  endDate: z.string().transform((str) => new Date(str)).nullable().optional(),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]).nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; advanceId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins and managers can update advances
    if (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.MANAGER) {
      return NextResponse.json({ error: "Forbidden - Admin or Manager access required" }, { status: 403 })
    }

    const { id, advanceId } = await params
    const userId = id
    const body = await request.json()
    const validatedData = updateAdvanceSchema.parse(body)

    // Verify advance belongs to user
    const existingAdvance = await prisma.officeAdvance.findFirst({
      where: {
        id: advanceId,
        userId,
      },
    })

    if (!existingAdvance) {
      return NextResponse.json({ error: "Advance not found" }, { status: 404 })
    }

    // Update advance
    const advance = await prisma.officeAdvance.update({
      where: { id: advanceId },
      data: {
        description: validatedData.description,
        amount: validatedData.amount,
        currency: validatedData.currency,
        startDate: validatedData.startDate,
        endDate: validatedData.endDate,
        frequency: validatedData.frequency as AdvanceFrequency | null,
        isActive: validatedData.isActive,
      },
    })

    return NextResponse.json({ advance })
  } catch (error: any) {
    console.error("Error updating advance:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }
    return NextResponse.json(
      { error: error.message || "Failed to update advance" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; advanceId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins and managers can delete advances
    if (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.MANAGER) {
      return NextResponse.json({ error: "Forbidden - Admin or Manager access required" }, { status: 403 })
    }

    const { id, advanceId } = await params
    const userId = id

    // Verify advance belongs to user
    const existingAdvance = await prisma.officeAdvance.findFirst({
      where: {
        id: advanceId,
        userId,
      },
    })

    if (!existingAdvance) {
      return NextResponse.json({ error: "Advance not found" }, { status: 404 })
    }

    // Deactivate instead of delete (soft delete)
    const advance = await prisma.officeAdvance.update({
      where: { id: advanceId },
      data: { isActive: false },
    })

    return NextResponse.json({ advance })
  } catch (error: any) {
    console.error("Error deleting advance:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete advance" },
      { status: 500 }
    )
  }
}
