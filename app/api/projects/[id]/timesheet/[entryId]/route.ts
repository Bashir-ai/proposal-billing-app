export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const timesheetEntryUpdateSchema = z.object({
  userId: z.string().optional(),
  date: z.string().optional(),
  hours: z.number().min(0).optional(),
  rate: z.number().min(0).optional().nullable(),
  description: z.string().optional(),
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

    if (session.user.role === "CLIENT") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const entry = await prisma.timesheetEntry.findUnique({
      where: { id: entryId },
    })

    if (!entry || entry.projectId !== id) {
      return NextResponse.json({ error: "Timesheet entry not found" }, { status: 404 })
    }

    // For EXTERNAL users, only allow access to assigned projects and their own entries
    if (session.user.role === "EXTERNAL") {
      const isAssigned = await prisma.projectManager.findFirst({
        where: {
          projectId: id,
          userId: session.user.id,
        },
      })
      if (!isAssigned) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      // EXTERNAL users can only update their own entries
      if (entry.userId !== session.user.id) {
        return NextResponse.json(
          { error: "Forbidden - External users can only update their own entries" },
          { status: 403 }
        )
      }
    }

    const body = await request.json()
    const validatedData = timesheetEntryUpdateSchema.parse(body)

    // For EXTERNAL users, prevent changing userId to someone else
    if (session.user.role === "EXTERNAL" && validatedData.userId !== undefined && validatedData.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden - External users cannot change entry ownership" },
        { status: 403 }
      )
    }

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
      updateData.date = new Date(validatedData.date)
    }
    if (validatedData.hours !== undefined) {
      updateData.hours = validatedData.hours
    }
    if (validatedData.rate !== undefined) {
      // If rate is explicitly null, set it to null
      // If rate is provided, use it
      // If rate is undefined, don't update it
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

    if (session.user.role === "CLIENT") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const entry = await prisma.timesheetEntry.findUnique({
      where: { id: entryId },
    })

    if (!entry || entry.projectId !== id) {
      return NextResponse.json({ error: "Timesheet entry not found" }, { status: 404 })
    }

    // For EXTERNAL users, only allow access to assigned projects and their own entries
    if (session.user.role === "EXTERNAL") {
      const isAssigned = await prisma.projectManager.findFirst({
        where: {
          projectId: id,
          userId: session.user.id,
        },
      })
      if (!isAssigned) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      // EXTERNAL users can only delete their own entries
      if (entry.userId !== session.user.id) {
        return NextResponse.json(
          { error: "Forbidden - External users can only delete their own entries" },
          { status: 403 }
        )
      }
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

