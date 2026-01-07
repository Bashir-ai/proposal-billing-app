import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

    // Get the finder fee
    const finderFee = await prisma.finderFee.findUnique({
      where: { id },
      include: {
        bill: {
          select: {
            id: true,
            invoiceNumber: true,
            amount: true,
            paidAt: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            company: true,
          },
        },
        payments: {
          orderBy: {
            paymentDate: "desc",
          },
        },
      },
    })

    if (!finderFee) {
      return NextResponse.json({ error: "Finder fee not found" }, { status: 404 })
    }

    // If user is not admin, check if this finder fee belongs to them
    if (session.user.role !== "ADMIN") {
      if (finderFee.finderId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    return NextResponse.json(finderFee)
  } catch (error) {
    console.error("Error fetching finder fee:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

