export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const paymentDetailsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  details: z.string().min(1, "Payment details are required"),
  isDefault: z.boolean().optional(),
})

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const paymentDetails = await prisma.paymentDetails.findMany({
      orderBy: [
        { isDefault: "desc" }, // Default first
        { name: "asc" },
      ],
    })

    return NextResponse.json(paymentDetails)
  } catch (error: any) {
    console.error("Error fetching payment details:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
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

    // Only admins and managers can create payment details
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = paymentDetailsSchema.parse(body)

    // If this is set as default, unset all other defaults
    if (validatedData.isDefault) {
      await prisma.paymentDetails.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }

    const paymentDetails = await prisma.paymentDetails.create({
      data: {
        name: validatedData.name,
        details: validatedData.details,
        isDefault: validatedData.isDefault || false,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      },
    })

    return NextResponse.json(paymentDetails, { status: 201 })
  } catch (error: any) {
    console.error("Error creating payment details:", error)
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}



