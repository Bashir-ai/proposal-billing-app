export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { BillStatus } from "@prisma/client"
import { generateInvoiceNumber } from "@/lib/invoice-number"
import { parseLocalDate } from "@/lib/utils"

const billSchema = z.object({
  proposalId: z.string().optional(),
  projectId: z.string().optional(),
  clientId: z.string().optional(), // Now optional - can be linked to client or lead
  leadId: z.string().optional(), // New: optional lead reference
  amount: z.number().min(0).optional(),
  subtotal: z.number().min(0).optional(),
  description: z.string().optional(),
  paymentDetailsId: z.string().optional(),
  taxInclusive: z.boolean().optional(),
  taxRate: z.number().min(0).max(100).optional().nullable(),
  discountPercent: z.number().min(0).max(100).optional().nullable(),
  discountAmount: z.number().min(0).optional().nullable(),
  dueDate: z.string().optional(),
  timesheetEntryIds: z.array(z.string()).optional(),
  chargeIds: z.array(z.string()).optional(),
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
    const leadId = searchParams.get("leadId")
    const projectId = searchParams.get("projectId")
    
    // Pagination parameters
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    const where: any = {
      deletedAt: null, // Exclude deleted items
    }
    if (status) {
      // Support comma-separated status values and "outstanding"
      if (status === "OUTSTANDING") {
        where.status = { not: "PAID" }
        where.dueDate = { lt: new Date() }
      } else {
        const statuses = status.split(",").map(s => s.trim())
        if (statuses.length === 1) {
          where.status = statuses[0]
        } else {
          where.status = { in: statuses }
        }
      }
    }
    if (clientId) where.clientId = clientId
    if (leadId) where.leadId = leadId
    if (projectId) where.projectId = projectId
    if (session.user.role === "CLIENT") {
      const client = await prisma.client.findFirst({
        where: { 
          email: session.user.email,
          deletedAt: null, // Exclude deleted clients
        },
      })
      if (client) {
        where.clientId = client.id
      } else {
        return NextResponse.json([])
      }
    }

    // For EXTERNAL users, only show invoices for clients where they are manager or finder
    if (session.user.role === "EXTERNAL") {
      // Get clients where user is manager or finder
      const clients = await prisma.client.findMany({
        where: {
          OR: [
            { clientManagerId: session.user.id },
            { finders: { some: { userId: session.user.id } } },
          ],
          deletedAt: null,
        },
        select: { id: true },
      })
      const clientIds = clients.map(c => c.id)
      if (clientIds.length === 0) {
        return NextResponse.json([])
      }
      // Filter bills to only those clients
      where.clientId = { in: clientIds }
    }

    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              company: true,
            },
          },
          lead: {
            select: {
              id: true,
              name: true,
              company: true,
              email: true,
            },
          },
          proposal: {
            select: {
              id: true,
              title: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          creator: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.bill.count({ where })
    ])

    return NextResponse.json({
      data: bills,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
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

    // Validate that either clientId or leadId is provided (or both)
    if (!validatedData.clientId && !validatedData.leadId) {
      return NextResponse.json(
        { error: "Either clientId or leadId must be provided" },
        { status: 400 }
      )
    }

    // Validate client exists if clientId provided
    if (validatedData.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: validatedData.clientId },
      })
      if (!client) {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 }
        )
      }
    }

    // Validate lead exists if leadId provided
    if (validatedData.leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: validatedData.leadId },
      })
      if (!lead) {
        return NextResponse.json(
          { error: "Lead not found" },
          { status: 404 }
        )
      }
    }

    // Fetch selected timesheet entries and charges if provided
    let itemsSubtotal = 0
    const billItemsToCreate: Array<{
      type: string
      description: string
      quantity: number | null
      rate: number | null
      unitPrice: number | null
      amount: number
      personId: string | null
      timesheetEntryId: string | null
      chargeId: string | null
      date: Date | null
      isCredit: boolean
      billedHours: number | null
      originalTimesheetEntryId: string | null
      isManuallyEdited: boolean
    }> = []

    if (validatedData.timesheetEntryIds && validatedData.timesheetEntryIds.length > 0) {
      const timesheetEntries = await prisma.timesheetEntry.findMany({
        where: {
          id: { in: validatedData.timesheetEntryIds },
          billed: false, // Safety check: only get unbilled items
        },
        include: {
          user: {
            select: {
              id: true,
            },
          },
        },
      })

      for (const entry of timesheetEntries) {
        const amount = (entry.rate || 0) * entry.hours
        itemsSubtotal += amount
        billItemsToCreate.push({
          type: "TIMESHEET",
          description: entry.description || `Timesheet entry - ${entry.hours} hours`,
          quantity: entry.hours,
          rate: entry.rate,
          unitPrice: entry.rate,
          amount: amount,
          personId: entry.userId,
          timesheetEntryId: entry.id,
          chargeId: null,
          date: entry.date,
          isCredit: false,
          billedHours: entry.hours, // Initially same as timesheet hours
          originalTimesheetEntryId: entry.id, // Track original entry
          isManuallyEdited: false, // Not edited yet
        })
      }
    }

    if (validatedData.chargeIds && validatedData.chargeIds.length > 0) {
      const charges = await prisma.projectCharge.findMany({
        where: {
          id: { in: validatedData.chargeIds },
          billed: false, // Safety check: only get unbilled items
        },
      })

      for (const charge of charges) {
        itemsSubtotal += charge.amount
        billItemsToCreate.push({
          type: "CHARGE",
          description: charge.description,
          quantity: charge.quantity || 1,
          rate: null,
          unitPrice: charge.unitPrice || charge.amount,
          amount: charge.amount,
          personId: null,
          timesheetEntryId: null,
          chargeId: charge.id,
          date: null,
          isCredit: false,
          billedHours: null, // Not applicable for charges
          originalTimesheetEntryId: null, // Not applicable for charges
          isManuallyEdited: false,
        })
      }
    }

    // Calculate subtotal: use items subtotal if items are selected, otherwise use provided subtotal
    let subtotal = itemsSubtotal > 0 ? itemsSubtotal : (validatedData.subtotal || validatedData.amount || 0)
    const taxInclusive = validatedData.taxInclusive || false
    const taxRate = validatedData.taxRate || null
    const discountPercent = validatedData.discountPercent || null
    const discountAmount = validatedData.discountAmount || null

    // Calculate discount
    let discountValue = 0
    if (discountPercent && discountPercent > 0) {
      discountValue = (subtotal * discountPercent) / 100
    } else if (discountAmount && discountAmount > 0) {
      discountValue = discountAmount
    }

    const afterDiscount = subtotal - discountValue

    // Calculate tax and final amount
    let taxAmount = 0
    let finalAmount = afterDiscount

    if (taxRate && taxRate > 0) {
      if (taxInclusive) {
        // Tax is included in the amount
        taxAmount = (afterDiscount * taxRate) / (100 + taxRate)
        finalAmount = afterDiscount // Amount already includes tax
      } else {
        // Tax is added on top
        taxAmount = (afterDiscount * taxRate) / 100
        finalAmount = afterDiscount + taxAmount
      }
    }

    // If amount was provided but not subtotal, use amount as subtotal
    if (validatedData.amount && !validatedData.subtotal) {
      subtotal = validatedData.amount
      finalAmount = validatedData.amount
    }

    // Generate invoice number for invoices created from scratch (no proposal or project)
    let invoiceNumber: string | null = null
    if (!validatedData.proposalId && !validatedData.projectId) {
      invoiceNumber = await generateInvoiceNumber()
      
      // Check if invoice number already exists (shouldn't happen, but safety check)
      const existingInvoice = await prisma.bill.findUnique({
        where: { invoiceNumber },
      })
      
      if (existingInvoice) {
        // If exists, generate a new one (shouldn't happen with sequential numbers, but just in case)
        invoiceNumber = await generateInvoiceNumber()
      }
    }

    // Create bill with items in a transaction
    const bill = await prisma.$transaction(async (tx) => {
      // Create the bill
      const createdBill = await tx.bill.create({
        data: {
          proposalId: validatedData.proposalId || null,
          projectId: validatedData.projectId || null,
          clientId: validatedData.clientId || null,
          leadId: validatedData.leadId || null,
          createdBy: session.user.id,
          amount: finalAmount,
          subtotal: subtotal,
          description: validatedData.description || null,
          paymentDetailsId: validatedData.paymentDetailsId || null,
          invoiceNumber: invoiceNumber,
          taxInclusive: taxInclusive,
          taxRate: taxRate,
          discountPercent: discountPercent,
          discountAmount: discountAmount,
          dueDate: validatedData.dueDate ? parseLocalDate(validatedData.dueDate) : null,
          status: BillStatus.DRAFT,
          items: {
            create: billItemsToCreate,
          },
        },
        include: {
          client: true,
          lead: true,
          proposal: true,
          items: true,
        },
      })

      // Mark timesheet entries as billed
      if (validatedData.timesheetEntryIds && validatedData.timesheetEntryIds.length > 0) {
        await tx.timesheetEntry.updateMany({
          where: {
            id: { in: validatedData.timesheetEntryIds },
          },
          data: {
            billed: true,
          },
        })
      }

      // Mark charges as billed
      if (validatedData.chargeIds && validatedData.chargeIds.length > 0) {
        await tx.projectCharge.updateMany({
          where: {
            id: { in: validatedData.chargeIds },
          },
          data: {
            billed: true,
          },
        })
      }

      return createdBill
    })

    return NextResponse.json(bill, { status: 201 })
  } catch (error) {
    console.error("Error creating bill:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      console.error("Error message:", error.message)
      console.error("Error stack:", error.stack)
    }

    return NextResponse.json(
      { error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}




