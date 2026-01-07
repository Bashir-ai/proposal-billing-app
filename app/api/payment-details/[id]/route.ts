import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const paymentDetailsUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  details: z.string().min(1, "Payment details are required").optional(),
  isDefault: z.boolean().optional(),
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

    const paymentDetails = await prisma.paymentDetails.findUnique({
      where: { id },
    })

    if (!paymentDetails) {
      return NextResponse.json({ error: "Payment details not found" }, { status: 404 })
    }

    return NextResponse.json(paymentDetails)
  } catch (error: any) {
    console.error("Error fetching payment details:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
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

    // Only admins and managers can update payment details
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = paymentDetailsUpdateSchema.parse(body)

    // If this is set as default, unset all other defaults
    if (validatedData.isDefault === true) {
      await prisma.paymentDetails.updateMany({
        where: { 
          isDefault: true,
          id: { not: id }, // Don't unset the current one
        },
        data: { isDefault: false },
      })
    }

    const paymentDetails = await prisma.paymentDetails.update({
      where: { id },
      data: {
        ...validatedData,
        updatedBy: session.user.id,
      },
    })

    return NextResponse.json(paymentDetails)
  } catch (error: any) {
    console.error("Error updating payment details:", error)
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

    // Only admins and managers can delete payment details
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    // Check if any bills are using this payment details
    const billsUsingThis = await prisma.bill.count({
      where: { paymentDetailsId: id },
    })

    if (billsUsingThis > 0) {
      return NextResponse.json(
        { error: `Cannot delete payment details. ${billsUsingThis} invoice(s) are using it.` },
        { status: 400 }
      )
    }

    await prisma.paymentDetails.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting payment details:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}


