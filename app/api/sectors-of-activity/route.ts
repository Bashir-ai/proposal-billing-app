import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const sectorOfActivitySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
})

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Anyone can view sectors of activity (for dropdowns)
    const sectors = await prisma.sectorOfActivity.findMany({
      orderBy: { name: "asc" },
    })

    return NextResponse.json(sectors)
  } catch (error) {
    console.error("Error fetching sectors of activity:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // All authenticated users can create sectors of activity

    const body = await request.json()
    const validatedData = sectorOfActivitySchema.parse(body)

    const sector = await prisma.sectorOfActivity.create({
      data: {
        name: validatedData.name,
        description: validatedData.description || null,
      },
    })

    return NextResponse.json(sector, { status: 201 })
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

    console.error("Error creating sector of activity:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

