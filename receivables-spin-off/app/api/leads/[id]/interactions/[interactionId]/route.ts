export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { InteractionType } from "@prisma/client"
import { parseLocalDate } from "@/lib/utils"

const interactionUpdateSchema = z.object({
  interactionType: z.nativeEnum(InteractionType).optional(),
  notes: z.string().optional(),
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

    // Verify interaction belongs to lead
    const interaction = await prisma.leadInteraction.findUnique({
      where: { id: interactionId },
    })

    if (!interaction || interaction.leadId !== id) {
      return NextResponse.json(
        { error: "Interaction not found" },
        { status: 404 }
      )
    }

    // Check if user is the creator of this interaction (allow admins/managers to edit any)
    if (interaction.createdBy !== session.user.id && session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return NextResponse.json(
        { error: "You can only edit your own interactions" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = interactionUpdateSchema.parse(body)

    const updateData: any = {}
    if (validatedData.interactionType !== undefined) {
      updateData.interactionType = validatedData.interactionType
    }
    if (validatedData.notes !== undefined) {
      updateData.notes = validatedData.notes || null
    }
    if (validatedData.date !== undefined) {
      // Fetch user's timezone to parse date correctly
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { timezone: true },
      })
      const userTimezone = user?.timezone || "UTC"
      
      // Parse date in local timezone to preserve the date as entered
      if (validatedData.date) {
        updateData.date = parseLocalDate(validatedData.date, userTimezone)
      } else {
        updateData.date = new Date()
      }
    }

    const updatedInteraction = await prisma.leadInteraction.update({
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

    console.error("Error updating lead interaction:", error)
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

    // Verify interaction belongs to lead
    const interaction = await prisma.leadInteraction.findUnique({
      where: { id: interactionId },
    })

    if (!interaction || interaction.leadId !== id) {
      return NextResponse.json(
        { error: "Interaction not found" },
        { status: 404 }
      )
    }

    // Check if user is the creator of this interaction (allow admins/managers to delete any)
    if (interaction.createdBy !== session.user.id && session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return NextResponse.json(
        { error: "You can only delete your own interactions" },
        { status: 403 }
      )
    }

    await prisma.leadInteraction.delete({
      where: { id: interactionId },
    })

    return NextResponse.json({ message: "Interaction deleted" })
  } catch (error) {
    console.error("Error deleting lead interaction:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}




