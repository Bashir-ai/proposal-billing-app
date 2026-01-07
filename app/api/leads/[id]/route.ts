export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { LeadStatus } from "@prisma/client"

const leadUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  company: z.string().optional(),
  phone: z.string().optional(),
  contactInfo: z.string().optional(),
  addressLine: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  areaOfLawId: z.string().optional().or(z.literal("")),
  sectorOfActivityId: z.string().optional().or(z.literal("")),
  leadManagerId: z.string().optional().or(z.literal("")),
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

    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const lead = await prisma.lead.findUnique({
      where: {
        id,
        deletedAt: null, // Exclude deleted leads (but allow archived)
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        leadManager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        areaOfLaw: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        sectorOfActivity: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        interactions: {
          orderBy: { date: "desc" },
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        todos: {
          where: {
            status: {
              not: "COMPLETED",
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        proposals: {
          where: {
            deletedAt: null,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        convertedToClient: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    return NextResponse.json(lead)
  } catch (error) {
    console.error("Error fetching lead:", error)
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

    if (session.user.role === "CLIENT") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = leadUpdateSchema.parse(body)

    const updateData: any = {}
    if (validatedData.name !== undefined) updateData.name = validatedData.name
    if (validatedData.email !== undefined) updateData.email = validatedData.email || null
    if (validatedData.company !== undefined) updateData.company = validatedData.company || null
    if (validatedData.phone !== undefined) updateData.phone = validatedData.phone || null
    if (validatedData.contactInfo !== undefined) updateData.contactInfo = validatedData.contactInfo || null
    if (validatedData.addressLine !== undefined) updateData.addressLine = validatedData.addressLine || null
    if (validatedData.city !== undefined) updateData.city = validatedData.city || null
    if (validatedData.state !== undefined) updateData.state = validatedData.state || null
    if (validatedData.zipCode !== undefined) updateData.zipCode = validatedData.zipCode || null
    if (validatedData.country !== undefined) updateData.country = validatedData.country || null
    if (validatedData.status !== undefined) updateData.status = validatedData.status
    if (validatedData.areaOfLawId !== undefined) updateData.areaOfLawId = validatedData.areaOfLawId || null
    if (validatedData.sectorOfActivityId !== undefined) updateData.sectorOfActivityId = validatedData.sectorOfActivityId || null
    if (validatedData.leadManagerId !== undefined) updateData.leadManagerId = validatedData.leadManagerId || null

    const lead = await prisma.lead.update({
      where: { id },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        leadManager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        areaOfLaw: {
          select: {
            id: true,
            name: true,
          },
        },
        sectorOfActivity: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(lead)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error updating lead:", error)
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

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden - Admin only" },
        { status: 403 }
      )
    }

    // Soft delete: set deletedAt timestamp
    await prisma.lead.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    })

    return NextResponse.json({ message: "Lead deleted" })
  } catch (error) {
    console.error("Error deleting lead:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    const action = body.action // "archive" or "unarchive"

    if (action === "archive") {
      await prisma.lead.update({
        where: { id },
        data: {
          archivedAt: new Date(),
        },
      })
      return NextResponse.json({ message: "Lead archived" })
    } else if (action === "unarchive") {
      await prisma.lead.update({
        where: { id },
        data: {
          archivedAt: null,
        },
      })
      return NextResponse.json({ message: "Lead unarchived" })
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'archive' or 'unarchive'" },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("Error archiving/unarchiving lead:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}



