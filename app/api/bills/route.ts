import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { BillStatus } from "@prisma/client"

const billSchema = z.object({
  proposalId: z.string().optional(),
  clientId: z.string(),
  amount: z.number().min(0),
  dueDate: z.string().optional(),
})

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const clientId = searchParams.get("clientId")

    const where: any = {}
    if (status) where.status = status
    if (clientId) where.clientId = clientId
    if (session.user.role === "CLIENT") {
      const client = await prisma.client.findFirst({
        where: { email: session.user.email },
      })
      if (client) {
        where.clientId = client.id
      } else {
        return NextResponse.json([])
      }
    }

    const bills = await prisma.bill.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            company: true,
          },
        },
        proposal: {
          select: {
            id: true,
            title: true,
          },
        },
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(bills)
  } catch (error) {
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

    if (session.user.role === "CLIENT") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = billSchema.parse(body)

    const bill = await prisma.bill.create({
      data: {
        proposalId: validatedData.proposalId || null,
        clientId: validatedData.clientId,
        createdBy: session.user.id,
        amount: validatedData.amount,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        status: BillStatus.DRAFT,
      },
      include: {
        client: true,
        proposal: true,
      },
    })

    return NextResponse.json(bill, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}




