export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { UserRole, FringeBenefitCategory } from "@prisma/client"

const updateBenefitSchema = z.object({
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  currency: z.string().optional(),
  benefitDate: z.string().transform((str) => new Date(str)).optional(),
  category: z.enum(["HEALTH", "TRANSPORT", "MEAL", "OTHER"]).optional(),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; benefitId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins and managers can update benefits
    if (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.MANAGER) {
      return NextResponse.json({ error: "Forbidden - Admin or Manager access required" }, { status: 403 })
    }

    const { id, benefitId } = await params
    const userId = id
    const body = await request.json()
    const validatedData = updateBenefitSchema.parse(body)

    // Verify benefit belongs to user
    const existingBenefit = await prisma.fringeBenefit.findFirst({
      where: {
        id: benefitId,
        userId,
      },
    })

    if (!existingBenefit) {
      return NextResponse.json({ error: "Fringe benefit not found" }, { status: 404 })
    }

    // Update benefit
    const benefit = await prisma.fringeBenefit.update({
      where: { id: benefitId },
      data: {
        description: validatedData.description,
        amount: validatedData.amount,
        currency: validatedData.currency,
        benefitDate: validatedData.benefitDate,
        category: validatedData.category as FringeBenefitCategory | undefined,
      },
    })

    return NextResponse.json({ benefit })
  } catch (error: any) {
    console.error("Error updating fringe benefit:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }
    return NextResponse.json(
      { error: error.message || "Failed to update fringe benefit" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; benefitId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins and managers can delete benefits
    if (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.MANAGER) {
      return NextResponse.json({ error: "Forbidden - Admin or Manager access required" }, { status: 403 })
    }

    const { id, benefitId } = await params
    const userId = id

    // Verify benefit belongs to user
    const existingBenefit = await prisma.fringeBenefit.findFirst({
      where: {
        id: benefitId,
        userId,
      },
    })

    if (!existingBenefit) {
      return NextResponse.json({ error: "Fringe benefit not found" }, { status: 404 })
    }

    // Delete benefit
    await prisma.fringeBenefit.delete({
      where: { id: benefitId },
    })

    return NextResponse.json({ message: "Fringe benefit deleted successfully" })
  } catch (error: any) {
    console.error("Error deleting fringe benefit:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete fringe benefit" },
      { status: 500 }
    )
  }
}
