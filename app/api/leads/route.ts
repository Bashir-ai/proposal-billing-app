export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { LeadStatus } from "@prisma/client"

const leadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.union([z.string().email(), z.literal("")]).optional().nullable(),
  company: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  contactInfo: z.string().optional().nullable(),
  addressLine: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  status: z.nativeEnum(LeadStatus).optional(),
  areaOfLawId: z.union([z.string(), z.literal("")]).optional().nullable(),
  sectorOfActivityId: z.union([z.string(), z.literal("")]).optional().nullable(),
  leadManagerId: z.union([z.string(), z.literal("")]).optional().nullable(),
})

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const areaOfLawId = searchParams.get("areaOfLawId")
    const sectorOfActivityId = searchParams.get("sectorOfActivityId")
    const search = searchParams.get("search")
    const archived = searchParams.get("archived") === "true"

    const where: any = {
      deletedAt: null, // Exclude deleted leads
    }

    if (!archived) {
      where.archivedAt = null // Exclude archived leads by default
    }

    if (status) {
      where.status = status
    }
    if (areaOfLawId) {
      where.areaOfLawId = areaOfLawId
    }
    if (sectorOfActivityId) {
      where.sectorOfActivityId = sectorOfActivityId
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
      ]
    }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
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
        _count: {
          select: {
            interactions: true,
            todos: true,
            proposals: true,
          },
        },
      },
    })

    return NextResponse.json(leads)
  } catch (error) {
    console.error("Error fetching leads:", error)
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
    const validatedData = leadSchema.parse(body)

    const lead = await prisma.lead.create({
      data: {
        name: validatedData.name,
        email: validatedData.email || null,
        company: validatedData.company || null,
        phone: validatedData.phone || null,
        contactInfo: validatedData.contactInfo || null,
        addressLine: validatedData.addressLine || null,
        city: validatedData.city || null,
        state: validatedData.state || null,
        zipCode: validatedData.zipCode || null,
        country: validatedData.country || null,
        status: validatedData.status || LeadStatus.NEW,
        areaOfLawId: validatedData.areaOfLawId || null,
        sectorOfActivityId: validatedData.sectorOfActivityId || null,
        leadManagerId: validatedData.leadManagerId || null,
        createdBy: session.user.id,
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

    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error creating lead:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

