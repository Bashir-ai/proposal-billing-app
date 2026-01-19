export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ChargeType, RecurringFrequency } from "@prisma/client"
import { isDatabaseConnectionError, getDatabaseErrorMessage } from "@/lib/database-error-handler"
import { parseLocalDate } from "@/lib/utils"

const chargeUpdateSchema = z.object({
  description: z.string().min(1).optional(),
  amount: z.number().min(0).optional(),
  quantity: z.number().min(0).optional().nullable(),
  unitPrice: z.number().min(0).optional().nullable(),
  chargeType: z.nativeEnum(ChargeType).optional(),
  recurringFrequency: z.nativeEnum(RecurringFrequency).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  billed: z.boolean().optional(),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; chargeId: string }> }
) {
  try {
    const { id, chargeId } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role === "CLIENT" || session.user.role === "EXTERNAL") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const charge = await prisma.projectCharge.findUnique({
      where: { id: chargeId },
    })

    if (!charge || charge.projectId !== id) {
      return NextResponse.json({ error: "Charge not found" }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = chargeUpdateSchema.parse(body)

    const updateData: any = {}
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description
    }
    if (validatedData.amount !== undefined) {
      updateData.amount = validatedData.amount
    }
    if (validatedData.quantity !== undefined) {
      updateData.quantity = validatedData.quantity
    }
    if (validatedData.unitPrice !== undefined) {
      updateData.unitPrice = validatedData.unitPrice
    }
    if (validatedData.chargeType !== undefined) {
      updateData.chargeType = validatedData.chargeType
    }
    if (validatedData.recurringFrequency !== undefined) {
      updateData.recurringFrequency = validatedData.recurringFrequency
    }
    if (validatedData.startDate !== undefined) {
      updateData.startDate = validatedData.startDate ? parseLocalDate(validatedData.startDate) : null
    }
    if (validatedData.endDate !== undefined) {
      updateData.endDate = validatedData.endDate ? parseLocalDate(validatedData.endDate) : null
    }
    if (validatedData.billed !== undefined) {
      updateData.billed = validatedData.billed
    }

    const updatedCharge = await prisma.projectCharge.update({
      where: { id: chargeId },
      data: updateData,
    })

    return NextResponse.json(updatedCharge)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
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

    console.error("Error updating charge:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; chargeId: string }> }
) {
  try {
    const { id, chargeId } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only ADMIN can delete charges
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden. Only admins can delete charges." },
        { status: 403 }
      )
    }

    const charge = await prisma.projectCharge.findUnique({
      where: { id: chargeId },
    })

    if (!charge || charge.projectId !== id) {
      return NextResponse.json({ error: "Charge not found" }, { status: 404 })
    }

    await prisma.projectCharge.delete({
      where: { id: chargeId },
    })

    return NextResponse.json({ success: true, message: "Charge deleted" })
  } catch (error: any) {
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        {
          error: "Database connection error",
          message: getDatabaseErrorMessage()
        },
        { status: 503 }
      )
    }
    console.error("Error deleting charge:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}
