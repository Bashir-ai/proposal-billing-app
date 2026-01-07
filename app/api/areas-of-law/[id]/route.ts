import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const areaOfLawUpdateSchema = z.object({
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

    const area = await prisma.areaOfLaw.findUnique({
      where: { id },
    })

    if (!area) {
      return NextResponse.json({ error: "Area of law not found" }, { status: 404 })
    }

    return NextResponse.json(area)
  } catch (error) {
    console.error("Error fetching area of law:", error)
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

    // Only admins can update areas of law
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden - Admin only" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = areaOfLawUpdateSchema.parse(body)

    const updateData: any = {}
    if (validatedData.name !== undefined) {
      updateData.name = validatedData.name
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description || null
    }

    const area = await prisma.areaOfLaw.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(area)
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
        { error: "An area of law with this name already exists" },
        { status: 409 }
      )
    }

    console.error("Error updating area of law:", error)
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

    // All authenticated users can delete areas of law

    // Check if area is being used by any leads
    const leadsCount = await prisma.lead.count({
      where: { areaOfLawId: id },
    })

    if (leadsCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${leadsCount} lead(s) are using this area of law` },
        { status: 400 }
      )
    }

    await prisma.areaOfLaw.delete({
      where: { id },
    })

    return NextResponse.json({ message: "Area of law deleted" })
  } catch (error) {
    console.error("Error deleting area of law:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

