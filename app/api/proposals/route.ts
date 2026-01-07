import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ProposalType, ProposalStatus } from "@prisma/client"
import { generateProposalNumber } from "@/lib/proposal-number"

const proposalItemSchema = z.object({
  billingMethod: z.enum(["FIXED_FEE", "SUCCESS_FEE", "RECURRING", "HOURLY", "CAPPED_FEE"]).optional(),
  personId: z.string().optional(),
  description: z.string(),
  quantity: z.number().optional(),
  rate: z.number().optional(),
  unitPrice: z.number().optional(),
  discountPercent: z.number().optional(),
  discountAmount: z.number().optional(),
  amount: z.number(),
  date: z.string().optional(),
  milestoneIds: z.array(z.string()).optional(), // Array of milestone IDs assigned to this item
  // Recurring payment fields (for item-level recurring)
  recurringEnabled: z.boolean().optional(),
  recurringFrequency: z.enum(["MONTHLY_1", "MONTHLY_3", "MONTHLY_6", "YEARLY_12", "CUSTOM"]).optional(),
  recurringCustomMonths: z.number().optional(),
  recurringStartDate: z.string().optional(),
})

const milestoneSchema = z.object({
  id: z.string().optional(), // Temporary ID for matching on create/update
  name: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().optional(),
  percent: z.number().optional(),
  dueDate: z.string().optional(),
})

const paymentTermSchema = z.object({
  proposalItemId: z.string().optional(), // Reference to specific proposal item (null for proposal-level terms)
  upfrontType: z.enum(["PERCENT", "FIXED_AMOUNT"]).optional(),
  upfrontValue: z.number().optional(),
  installmentType: z.enum(["TIME_BASED", "MILESTONE_BASED"]).optional(),
  installmentCount: z.number().optional(),
  installmentFrequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY"]).optional(),
  milestoneIds: z.array(z.string()).optional(),
  // Balance payment fields
  balancePaymentType: z.enum(["MILESTONE_BASED", "TIME_BASED", "FULL_UPFRONT"]).optional(),
  balanceDueDate: z.string().optional(), // ISO date string
  // Installment maturity dates (custom dates for each installment)
  installmentMaturityDates: z.array(z.string()).optional(), // Array of ISO date strings
  // Recurring payment fields
  recurringEnabled: z.boolean().optional(),
  recurringFrequency: z.enum(["MONTHLY_1", "MONTHLY_3", "MONTHLY_6", "YEARLY_12", "CUSTOM"]).optional(),
  recurringCustomMonths: z.number().optional(),
  recurringStartDate: z.string().optional(), // ISO date string
})

const proposalSchema = z.object({
  clientId: z.string().optional(),
  leadId: z.string().optional(),
  type: z.nativeEnum(ProposalType),
  title: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().optional(),
  proposalNumber: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  currency: z.string().default("EUR"),
  taxInclusive: z.boolean().default(false),
  taxRate: z.number().optional(),
  clientDiscountPercent: z.number().optional(),
  clientDiscountAmount: z.number().optional(),
  estimatedHours: z.number().optional(),
  hourlyRateRangeMin: z.number().optional(),
  hourlyRateRangeMax: z.number().optional(),
  hourlyCapHours: z.number().optional(),
  cappedAmount: z.number().optional(),
  retainerMonthlyAmount: z.number().optional(),
  retainerHourlyCap: z.number().optional(),
  blendedRate: z.number().optional(),
  useBlendedRate: z.boolean().optional(),
  successFeePercent: z.number().optional(),
  successFeeAmount: z.number().optional(),
  successFeeValue: z.number().optional(),
  fixedAmount: z.number().optional(),
  outOfScopeHourlyRate: z.number().optional(),
  tagIds: z.array(z.string()).optional(),
  customTags: z.array(z.string()).optional(),
  items: z.array(proposalItemSchema).optional(),
  milestones: z.array(milestoneSchema).optional(),
  paymentTerms: z.array(paymentTermSchema).optional(),
  mixedModelMethods: z.array(z.string()).optional(), // Not stored in DB, just for validation
  // Recurring payment fields (proposal-level)
  recurringEnabled: z.boolean().optional(),
  recurringFrequency: z.enum(["MONTHLY_1", "MONTHLY_3", "MONTHLY_6", "YEARLY_12", "CUSTOM"]).optional(),
  recurringCustomMonths: z.number().optional(),
  recurringStartDate: z.string().optional(),
})

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const type = searchParams.get("type")
    const clientId = searchParams.get("clientId")
    const clientApprovalStatus = searchParams.get("clientApprovalStatus")
    const tagId = searchParams.get("tagId")

    const where: any = {
      deletedAt: null, // Exclude deleted items
    }
    if (status) where.status = status
    if (type) where.type = type
    if (clientId) where.clientId = clientId
    if (clientApprovalStatus) where.clientApprovalStatus = clientApprovalStatus
    if (tagId) {
      where.tags = {
        some: {
          id: tagId,
        },
      }
    }
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

    const proposals = await prisma.proposal.findMany({
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
        lead: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
            status: true,
          },
        },
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
        tags: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        items: {
          select: {
            id: true,
            description: true,
            amount: true,
            billingMethod: true,
            recurringEnabled: true,
          },
        },
        _count: {
          select: {
            approvals: true,
          },
        },
      },
    })

    return NextResponse.json(proposals)
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
    const validatedData = proposalSchema.parse(body)

    // Validate that either clientId or leadId is provided, but not both
    if (!validatedData.clientId && !validatedData.leadId) {
      return NextResponse.json(
        { error: "Either clientId or leadId must be provided" },
        { status: 400 }
      )
    }

    if (validatedData.clientId && validatedData.leadId) {
      return NextResponse.json(
        { error: "Cannot specify both clientId and leadId. Use either clientId or leadId." },
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

    // Generate proposal number if not provided
    let proposalNumber = validatedData.proposalNumber
    if (!proposalNumber) {
      proposalNumber = await generateProposalNumber()
    }

    // Validate expiry date is after issue date
    if (validatedData.expiryDate && validatedData.issueDate) {
      const issueDate = new Date(validatedData.issueDate)
      const expiryDate = new Date(validatedData.expiryDate)
      if (expiryDate < issueDate) {
        return NextResponse.json(
          { error: "Expiry date must be after issue date" },
          { status: 400 }
        )
      }
    }

    // Create proposal first (without milestones and items)
    const proposal = await prisma.proposal.create({
      data: {
        clientId: validatedData.clientId || null,
        leadId: validatedData.leadId || null,
        createdBy: session.user.id,
        type: validatedData.type,
        title: validatedData.title,
        description: validatedData.description || null,
        amount: validatedData.amount || null,
        proposalNumber,
        issueDate: validatedData.issueDate ? new Date(validatedData.issueDate) : null,
        expiryDate: validatedData.expiryDate ? new Date(validatedData.expiryDate) : null,
        currency: validatedData.currency || "EUR",
        taxInclusive: validatedData.taxInclusive ?? false,
        taxRate: validatedData.taxRate || null,
        clientDiscountPercent: validatedData.clientDiscountPercent || null,
        clientDiscountAmount: validatedData.clientDiscountAmount || null,
        estimatedHours: validatedData.estimatedHours || null,
        hourlyRateRangeMin: validatedData.hourlyRateRangeMin || null,
        hourlyRateRangeMax: validatedData.hourlyRateRangeMax || null,
        hourlyCapHours: validatedData.hourlyCapHours || null,
        cappedAmount: validatedData.cappedAmount || null,
        retainerMonthlyAmount: validatedData.retainerMonthlyAmount || null,
        retainerHourlyCap: validatedData.retainerHourlyCap || null,
        blendedRate: validatedData.blendedRate || null,
        useBlendedRate: validatedData.useBlendedRate ?? false,
        successFeePercent: validatedData.successFeePercent || null,
        successFeeAmount: validatedData.successFeeAmount || null,
        successFeeValue: validatedData.successFeeValue || null,
        fixedAmount: validatedData.fixedAmount || null,
        outOfScopeHourlyRate: validatedData.outOfScopeHourlyRate || null,
        customTags: validatedData.customTags || [],
        status: ProposalStatus.DRAFT,
        // Recurring payment fields
        recurringEnabled: validatedData.recurringEnabled ?? false,
        recurringFrequency: validatedData.recurringFrequency || null,
        recurringCustomMonths: validatedData.recurringCustomMonths || null,
        recurringStartDate: validatedData.recurringStartDate ? new Date(validatedData.recurringStartDate) : null,
        tags: validatedData.tagIds ? {
          connect: validatedData.tagIds.map(id => ({ id })),
        } : undefined,
      },
    })

    // Create milestones first and build a map of temp IDs to DB IDs
    const milestoneIdMap = new Map<string, string>()
    if (validatedData.milestones && validatedData.milestones.length > 0) {
      for (const milestone of validatedData.milestones) {
        const createdMilestone = await prisma.milestone.create({
          data: {
            proposalId: proposal.id,
            name: milestone.name,
            description: milestone.description || null,
            amount: milestone.amount || null,
            percent: milestone.percent || null,
            dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
          },
        })
        // Map temporary ID to actual DB ID
        if (milestone.id) {
          milestoneIdMap.set(milestone.id, createdMilestone.id)
        }
      }
    }

    // Create line items with milestone assignments
    if (validatedData.items && validatedData.items.length > 0) {
      for (const item of validatedData.items) {
        // Map temporary milestone IDs to actual DB IDs
        const actualMilestoneIds = (item.milestoneIds || [])
          .map(tempId => milestoneIdMap.get(tempId))
          .filter((id): id is string => id !== undefined)

        const createdItem = await prisma.proposalItem.create({
          data: {
            proposalId: proposal.id,
            billingMethod: item.billingMethod || null,
            personId: item.personId || null,
            description: item.description,
            quantity: item.quantity || null,
            rate: item.rate || null,
            unitPrice: item.unitPrice || null,
            discountPercent: item.discountPercent || null,
            discountAmount: item.discountAmount || null,
            amount: item.amount,
            date: null, // Dates are only for actual billing/timesheet entries, not proposals
            // Recurring payment fields (for item-level recurring)
            recurringEnabled: item.recurringEnabled ?? false,
            recurringFrequency: item.recurringFrequency || null,
            recurringCustomMonths: item.recurringCustomMonths || null,
            recurringStartDate: item.recurringStartDate ? new Date(item.recurringStartDate) : null,
            milestones: actualMilestoneIds.length > 0 ? {
              connect: actualMilestoneIds.map(id => ({ id })),
            } : undefined,
          },
        })
      }
    }

    // Create payment terms after proposal and items are created
    if (validatedData.paymentTerms && Array.isArray(validatedData.paymentTerms) && validatedData.paymentTerms.length > 0) {
      const createdItems = await prisma.proposalItem.findMany({
        where: { proposalId: proposal.id },
        orderBy: { createdAt: "asc" },
      })

      // Filter out null/undefined terms and only keep terms with actual data
      const validPaymentTerms = validatedData.paymentTerms.filter(term => 
        term && (term.upfrontType || term.installmentType)
      )

      if (validPaymentTerms.length > 0) {
        const paymentTermsToCreate = validPaymentTerms.map((term, index) => {
          // First term is proposal-level (no proposalItemId), rest are item-level
          const isProposalLevel = index === 0 && !term.proposalItemId
          const itemIndex = isProposalLevel ? -1 : index - 1
          
          return {
            proposalId: proposal.id,
            proposalItemId: isProposalLevel ? null : (createdItems[itemIndex]?.id || null),
            upfrontType: term.upfrontType || null,
            upfrontValue: term.upfrontValue || null,
            installmentType: term.installmentType || null,
            installmentCount: term.installmentCount || null,
            installmentFrequency: term.installmentFrequency || null,
            milestoneIds: Array.isArray(term.milestoneIds) ? term.milestoneIds : [],
            // Balance payment fields
            balancePaymentType: term.balancePaymentType || null,
            balanceDueDate: term.balanceDueDate ? new Date(term.balanceDueDate) : null,
            // Installment maturity dates
            installmentMaturityDates: Array.isArray(term.installmentMaturityDates) 
              ? term.installmentMaturityDates.map(date => new Date(date))
              : [],
            // Recurring payment fields
            recurringEnabled: term.recurringEnabled ?? false,
            recurringFrequency: term.recurringFrequency || null,
            recurringCustomMonths: term.recurringCustomMonths || null,
            recurringStartDate: term.recurringStartDate ? new Date(term.recurringStartDate) : null,
          }
        })

        if (paymentTermsToCreate.length > 0) {
          await prisma.paymentTerm.createMany({
            data: paymentTermsToCreate,
          })
        }
      }
    }

    // Fetch final proposal with all relations
    const finalProposal = await prisma.proposal.findUnique({
      where: { id: proposal.id },
      include: {
        client: true,
        items: {
          include: {
            person: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            milestones: {
              select: {
                id: true,
                name: true,
                description: true,
                amount: true,
                percent: true,
                dueDate: true,
              },
            },
          },
        },
        milestones: true,
        tags: true,
        paymentTerms: true,
      },
    })

    return NextResponse.json(finalProposal, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error creating proposal:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}



