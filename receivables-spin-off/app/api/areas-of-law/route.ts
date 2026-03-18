export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const areaOfLawSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
})

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Anyone can view areas of law (for dropdowns)
    const areas = await prisma.areaOfLaw.findMany({
      orderBy: { name: "asc" },
    })

    return NextResponse.json(areas)
  } catch (error) {
    console.error("Error fetching areas of law:", error)
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

    // All authenticated users can create areas of law

    const body = await request.json()
    const validatedData = areaOfLawSchema.parse(body)

    const area = await prisma.areaOfLaw.create({
      data: {
        name: validatedData.name,
        description: validatedData.description || null,
      },
    })

    return NextResponse.json(area, { status: 201 })
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

    console.error("Error creating area of law:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

