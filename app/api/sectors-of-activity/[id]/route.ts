import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const sectorOfActivityUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sector = await prisma.sectorOfActivity.findUnique({
      where: { id },
    })

    if (!sector) {
      return NextResponse.json({ error: "Sector of activity not found" }, { status: 404 })
    }

    return NextResponse.json(sector)
  } catch (error) {
    console.error("Error fetching sector of activity:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can update sectors of activity
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden - Admin only" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = sectorOfActivityUpdateSchema.parse(body)

    const updateData: any = {}
    if (validatedData.name !== undefined) {
      updateData.name = validatedData.name
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description || null
    }

    const sector = await prisma.sectorOfActivity.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(sector)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "A sector of activity with this name already exists" },
        { status: 409 }
      )
    }

    console.error("Error updating sector of activity:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can delete sectors of activity
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden - Admin only" },
        { status: 403 }
      )
    }

    // Check if sector is being used by any leads
    const leadsCount = await prisma.lead.count({
      where: { sectorOfActivityId: id },
    })

    if (leadsCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${leadsCount} lead(s) are using this sector of activity` },
        { status: 400 }
      )
    }

    await prisma.sectorOfActivity.delete({
      where: { id },
    })

    return NextResponse.json({ message: "Sector of activity deleted" })
  } catch (error) {
    console.error("Error deleting sector of activity:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

