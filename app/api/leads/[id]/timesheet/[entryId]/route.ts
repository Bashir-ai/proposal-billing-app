export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { parseLocalDate } from "@/lib/utils"
import { getCurrentUserTimezone } from "@/lib/timezone-utils"

const timesheetEntryUpdateSchema = z.object({
  userId: z.string().optional(),
  date: z.string().optional(),
  hours: z.number().min(0).optional(),
  rate: z.number().min(0).optional().nullable(),
  description: z.string().optional().or(z.literal("")).nullable(),
  billable: z.boolean().optional(),
  billed: z.boolean().optional(),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const { id, entryId } = await params
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

    const entry = await prisma.timesheetEntry.findUnique({
      where: { id: entryId },
    })

    if (!entry || entry.leadId !== id) {
      return NextResponse.json({ error: "Timesheet entry not found" }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = timesheetEntryUpdateSchema.parse(body)

    const updateData: any = {}
    if (validatedData.userId !== undefined) {
      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: validatedData.userId },
      })
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }
      updateData.userId = validatedData.userId
    }
    if (validatedData.date !== undefined) {
      updateData.date = parseLocalDate(validatedData.date, await getCurrentUserTimezone())
    }
    if (validatedData.hours !== undefined) {
      updateData.hours = validatedData.hours
    }
    if (validatedData.rate !== undefined) {
      updateData.rate = validatedData.rate
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description || null
    }
    if (validatedData.billable !== undefined) {
      updateData.billable = validatedData.billable
    }
    if (validatedData.billed !== undefined) {
      updateData.billed = validatedData.billed
    }

    const updatedEntry = await prisma.timesheetEntry.update({
      where: { id: entryId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(updatedEntry)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error updating timesheet entry:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const { id, entryId } = await params
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

    const entry = await prisma.timesheetEntry.findUnique({
      where: { id: entryId },
    })

    if (!entry || entry.leadId !== id) {
      return NextResponse.json({ error: "Timesheet entry not found" }, { status: 404 })
    }

    await prisma.timesheetEntry.delete({
      where: { id: entryId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting timesheet entry:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}
