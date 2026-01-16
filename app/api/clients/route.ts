export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { isDatabaseConnectionError, getDatabaseErrorMessage } from "@/lib/database-error-handler"

const contactPersonSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  position: z.string().optional(),
  isPrimary: z.boolean().default(false),
})

const clientFinderSchema = z.object({
  userId: z.string().min(1),
  finderFeePercent: z.number().min(0).max(100).default(0),
})

const clientSchema = z.object({
  name: z.string().min(1),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  company: z.string().optional(),
  contactInfo: z.string().optional(),
  portugueseTaxNumber: z.string().optional(),
  foreignTaxNumber: z.string().optional(),
  kycCompleted: z.boolean().default(false),
  isIndividual: z.boolean().optional().default(false),
  fullLegalName: z.string().optional(),
  billingAddressLine: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
  billingZipCode: z.string().optional(),
  billingCountry: z.string().optional(),
  clientManagerId: z.string().optional().or(z.literal("")),
  referrerName: z.string().optional().nullable(),
  referrerContactInfo: z.string().optional().nullable(),
  finders: z.array(clientFinderSchema).optional(),
  contacts: z.array(contactPersonSchema).optional(),
})

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const clients = await prisma.client.findMany({
      where: {
        deletedAt: null, // Exclude deleted clients
        archivedAt: null, // Exclude archived clients
      },
      orderBy: { createdAt: "desc" },
      include: {
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
        finders: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        clientManager: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(clients)
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        { 
          error: "Database connection error",
          message: getDatabaseErrorMessage()
        },
        { status: 503 }
      )
    }
    console.error("Error fetching clients:", error)
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      },
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
    const validatedData = clientSchema.parse(body)

    const client = await prisma.client.create({
      data: {
        name: validatedData.name,
        email: validatedData.email || null,
        company: validatedData.company || null,
        contactInfo: validatedData.contactInfo || null,
        portugueseTaxNumber: validatedData.portugueseTaxNumber || null,
        foreignTaxNumber: validatedData.foreignTaxNumber || null,
        kycCompleted: validatedData.kycCompleted || false,
        isIndividual: validatedData.isIndividual || false,
        fullLegalName: validatedData.fullLegalName || null,
        billingAddressLine: validatedData.billingAddressLine || null,
        billingCity: validatedData.billingCity || null,
        billingState: validatedData.billingState || null,
        billingZipCode: validatedData.billingZipCode || null,
        billingCountry: validatedData.billingCountry || null,
        clientManagerId: validatedData.clientManagerId || null,
        referrerName: validatedData.referrerName || null,
        referrerContactInfo: validatedData.referrerContactInfo || null,
        createdBy: session.user.id,
        finders: validatedData.finders && validatedData.finders.length > 0
          ? {
              create: validatedData.finders.map((finder) => ({
                userId: finder.userId,
                finderFeePercent: finder.finderFeePercent,
              })),
            }
          : undefined,
        contacts: validatedData.contacts && validatedData.contacts.length > 0
          ? {
              create: validatedData.contacts.map((contact) => ({
                name: contact.name,
                email: contact.email || null,
                phone: contact.phone || null,
                position: contact.position || null,
                isPrimary: contact.isPrimary || false,
              })),
            }
          : undefined,
      },
      include: {
        contacts: true,
        finders: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        clientManager: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        { 
          error: "Database connection error",
          message: getDatabaseErrorMessage()
        },
        { status: 503 }
      )
    }
    console.error("Error creating client:", error)
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}




