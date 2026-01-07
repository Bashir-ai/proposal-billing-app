export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const convertSchema = z.object({
  keepLeadRecord: z.boolean().default(true), // Whether to keep the lead record after conversion
})

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

    // Get the lead
    const lead = await prisma.lead.findUnique({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        areaOfLaw: true,
        sectorOfActivity: true,
      },
    })

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    if (lead.convertedToClientId) {
      return NextResponse.json(
        { error: "Lead has already been converted to a client" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = convertSchema.parse(body)

    // Create client from lead data
    const client = await prisma.client.create({
      data: {
        name: lead.name,
        email: lead.email,
        company: lead.company,
        contactInfo: lead.contactInfo,
        billingAddressLine: lead.addressLine,
        billingCity: lead.city,
        billingState: lead.state,
        billingZipCode: lead.zipCode,
        billingCountry: lead.country,
        createdBy: session.user.id,
        // Note: We don't transfer leadManager to clientManager automatically
        // The user can assign a client manager separately if needed
      },
    })

    // Update lead to mark as converted
    await prisma.lead.update({
      where: { id },
      data: {
        convertedToClientId: client.id,
        convertedAt: new Date(),
        status: "CONVERTED",
      },
    })

    // If keepLeadRecord is false, soft delete the lead
    if (!validatedData.keepLeadRecord) {
      await prisma.lead.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      })
    }

    return NextResponse.json({
      message: "Lead converted to client successfully",
      client: {
        id: client.id,
        name: client.name,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error converting lead to client:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}



