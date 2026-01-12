export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { UserRole } from "@prisma/client"

const eligibilitySchema = z.object({
  compensationId: z.string(),
  projectId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  billId: z.string().optional().nullable(),
  isEligible: z.boolean().default(true),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const userId = id

    // Users can only view their own eligibility, admins can view anyone's
    if (session.user.role !== UserRole.ADMIN && session.user.id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const compensationId = searchParams.get("compensationId")
    const projectId = searchParams.get("projectId")
    const clientId = searchParams.get("clientId")
    const billId = searchParams.get("billId")

    const where: any = { userId }
    if (compensationId) where.compensationId = compensationId
    if (projectId) where.projectId = projectId
    if (clientId) where.clientId = clientId
    if (billId) where.billId = billId

    const eligibility = await prisma.compensationEligibility.findMany({
      where,
      include: {
        compensation: {
          select: {
            id: true,
            compensationType: true,
            percentageType: true,
            projectPercentage: true,
            directWorkPercentage: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            company: true,
          },
        },
        bill: {
          select: {
            id: true,
            invoiceNumber: true,
            amount: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ eligibility })
  } catch (error: any) {
    console.error("Error fetching eligibility:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch eligibility" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can create eligibility records
    if (session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
    }

    const { id } = await params
    const userId = id
    const body = await request.json()
    const validatedData = eligibilitySchema.parse(body)

    // Validate that exactly one of projectId, clientId, or billId is set
    const identifiers = [validatedData.projectId, validatedData.clientId, validatedData.billId].filter(Boolean)
    if (identifiers.length !== 1) {
      return NextResponse.json(
        { error: "Exactly one of projectId, clientId, or billId must be provided" },
        { status: 400 }
      )
    }

    // Verify compensation exists and belongs to user
    const compensation = await prisma.userCompensation.findFirst({
      where: {
        id: validatedData.compensationId,
        userId,
      },
    })

    if (!compensation) {
      return NextResponse.json({ error: "Compensation not found" }, { status: 404 })
    }

    // Verify the referenced entity exists
    if (validatedData.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: validatedData.projectId },
      })
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }
    }

    if (validatedData.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: validatedData.clientId },
      })
      if (!client) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 })
      }
    }

    if (validatedData.billId) {
      const bill = await prisma.bill.findUnique({
        where: { id: validatedData.billId },
      })
      if (!bill) {
        return NextResponse.json({ error: "Bill not found" }, { status: 404 })
      }
    }

    // Create or update eligibility record
    // Convert undefined to null for Prisma unique constraint
    const projectIdValue = validatedData.projectId ?? null
    const clientIdValue = validatedData.clientId ?? null
    const billIdValue = validatedData.billId ?? null

    const eligibility = await prisma.compensationEligibility.upsert({
      where: {
        userId_compensationId_projectId_clientId_billId: {
          userId,
          compensationId: validatedData.compensationId,
          projectId: projectIdValue,
          clientId: clientIdValue,
          billId: billIdValue,
        },
      },
      update: {
        isEligible: validatedData.isEligible,
      },
      create: {
        userId,
        compensationId: validatedData.compensationId,
        projectId: projectIdValue,
        clientId: clientIdValue,
        billId: billIdValue,
        isEligible: validatedData.isEligible,
      },
      include: {
        compensation: {
          select: {
            id: true,
            compensationType: true,
            percentageType: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        bill: {
          select: {
            id: true,
            invoiceNumber: true,
          },
        },
      },
    })

    return NextResponse.json({ eligibility }, { status: 201 })
  } catch (error: any) {
    console.error("Error creating eligibility:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }
    return NextResponse.json(
      { error: error.message || "Failed to create eligibility" },
      { status: 500 }
    )
  }
}
