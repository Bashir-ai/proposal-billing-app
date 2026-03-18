export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { InteractionType } from "@prisma/client"

const interactionUpdateSchema = z.object({
  interactionType: z.nativeEnum(InteractionType).optional(),
  notes: z.string().optional(),
  paymentRemarks: z.string().optional(),
  extensionDate: z.string().optional(),
  date: z.string().optional(),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; interactionId: string }> }
) {
  try {
    const { id, interactionId } = await params
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

    // Verify interaction belongs to bill
    const interaction = await prisma.invoiceInteraction.findUnique({
      where: { id: interactionId },
    })

    if (!interaction || interaction.billId !== id) {
      return NextResponse.json(
        { error: "Interaction not found" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validatedData = interactionUpdateSchema.parse(body)

    // Validate interaction type if provided
    if (validatedData.interactionType !== undefined && 
        validatedData.interactionType !== "EMAIL_SENT" && 
        validatedData.interactionType !== "PHONE_CALL") {
      return NextResponse.json(
        { error: "Only EMAIL_SENT and PHONE_CALL interaction types are allowed for invoices" },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (validatedData.interactionType !== undefined) {
      updateData.interactionType = validatedData.interactionType
    }
    if (validatedData.notes !== undefined) {
      updateData.notes = validatedData.notes || null
    }
    if (validatedData.paymentRemarks !== undefined) {
      updateData.paymentRemarks = validatedData.paymentRemarks || null
    }
    if (validatedData.date !== undefined) {
      // Parse date in local timezone to preserve the date as entered
      if (validatedData.date) {
        const [year, month, day] = validatedData.date.split('-').map(Number)
        updateData.date = new Date(year, month - 1, day)
      } else {
        updateData.date = new Date()
      }
    }
    if (validatedData.extensionDate !== undefined) {
      if (validatedData.extensionDate) {
        const [year, month, day] = validatedData.extensionDate.split('-').map(Number)
        const extensionDate = new Date(year, month - 1, day)
        
        // Validate extension date is in the future
        if (extensionDate <= new Date()) {
          return NextResponse.json(
            { error: "Extension date must be in the future" },
            { status: 400 }
          )
        }
        updateData.extensionDate = extensionDate
      } else {
        updateData.extensionDate = null
      }
    }

    const updatedInteraction = await prisma.invoiceInteraction.update({
      where: { id: interactionId },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(updatedInteraction)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error updating invoice interaction:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; interactionId: string }> }
) {
  try {
    const { id, interactionId } = await params
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

    // Verify interaction belongs to bill
    const interaction = await prisma.invoiceInteraction.findUnique({
      where: { id: interactionId },
    })

    if (!interaction || interaction.billId !== id) {
      return NextResponse.json(
        { error: "Interaction not found" },
        { status: 404 }
      )
    }

    await prisma.invoiceInteraction.delete({
      where: { id: interactionId },
    })

    return NextResponse.json({ message: "Interaction deleted" })
  } catch (error) {
    console.error("Error deleting invoice interaction:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
