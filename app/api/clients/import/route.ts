import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const bulkClientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  company: z.string().optional().nullable(),
  contactInfo: z.string().optional().nullable(),
  portugueseTaxNumber: z.string().optional().nullable(),
  foreignTaxNumber: z.string().optional().nullable(),
  kycCompleted: z.boolean().optional().default(false),
})

const importRequestSchema = z.object({
  clients: z.array(bulkClientSchema),
})

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
    const validatedData = importRequestSchema.parse(body)

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string }>,
    }

    // Process each client
    for (let i = 0; i < validatedData.clients.length; i++) {
      const clientData = validatedData.clients[i]
      try {
        // Check if client with same email already exists (if email provided)
        if (clientData.email) {
          const existing = await prisma.client.findFirst({
            where: { 
              email: clientData.email,
              deletedAt: null, // Only check non-deleted clients
            },
          })
          if (existing) {
            results.failed++
            results.errors.push({
              row: i + 1,
              error: `Client with email ${clientData.email} already exists`,
            })
            continue
          }
        }

        // Create client
        await prisma.client.create({
          data: {
            name: clientData.name,
            email: clientData.email || null,
            company: clientData.company || null,
            contactInfo: clientData.contactInfo || null,
            portugueseTaxNumber: clientData.portugueseTaxNumber || null,
            foreignTaxNumber: clientData.foreignTaxNumber || null,
            kycCompleted: clientData.kycCompleted || false,
            createdBy: session.user.id,
          },
        })

        results.success++
      } catch (error) {
        results.failed++
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        results.errors.push({
          row: i + 1,
          error: errorMessage,
        })
      }
    }

    return NextResponse.json({
      message: `Import completed: ${results.success} successful, ${results.failed} failed`,
      results,
    })
  } catch (error) {
    console.error("Error importing clients:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

