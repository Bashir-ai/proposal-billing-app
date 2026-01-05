import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ChargeType, RecurringFrequency } from "@prisma/client"

const projectChargeUpdateSchema = z.object({
  description: z.string().min(1).optional(),
  amount: z.number().min(0).optional(),
  quantity: z.number().min(0).optional(),
  unitPrice: z.number().min(0).optional(),
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

    if (session.user.role === "CLIENT") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const charge = await prisma.projectCharge.findUnique({
      where: { id: chargeId },
    })

    if (!charge || charge.projectId !== id) {
      return NextResponse.json({ error: "Project charge not found" }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = projectChargeUpdateSchema.parse(body)

    const updateData: any = {}
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description
    }
    if (validatedData.quantity !== undefined) {
      updateData.quantity = validatedData.quantity
    }
    if (validatedData.unitPrice !== undefined) {
      updateData.unitPrice = validatedData.unitPrice
    }
    if (validatedData.amount !== undefined) {
      updateData.amount = validatedData.amount
    } else if (validatedData.quantity !== undefined && validatedData.unitPrice !== undefined) {
      // Recalculate amount if quantity or unitPrice changed
      updateData.amount = validatedData.quantity * validatedData.unitPrice
    }
    if (validatedData.chargeType !== undefined) {
      updateData.chargeType = validatedData.chargeType
    }
    if (validatedData.recurringFrequency !== undefined) {
      updateData.recurringFrequency = validatedData.recurringFrequency
    }
    if (validatedData.startDate !== undefined) {
      updateData.startDate = validatedData.startDate ? new Date(validatedData.startDate) : null
    }
    if (validatedData.endDate !== undefined) {
      updateData.endDate = validatedData.endDate ? new Date(validatedData.endDate) : null
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

    console.error("Error updating project charge:", error)
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

    if (session.user.role === "CLIENT") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const charge = await prisma.projectCharge.findUnique({
      where: { id: chargeId },
    })

    if (!charge || charge.projectId !== id) {
      return NextResponse.json({ error: "Project charge not found" }, { status: 404 })
    }

    await prisma.projectCharge.delete({
      where: { id: chargeId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting project charge:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}



