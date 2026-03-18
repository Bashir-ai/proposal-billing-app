export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ProposalType, ProposalStatus } from "@prisma/client"
import { generateProposalNumber } from "@/lib/proposal-number"
import { parseLocalDate } from "@/lib/utils"

const proposalItemSchema = z.object({
  billingMethod: z.enum(["FIXED_FEE", "SUCCESS_FEE", "RECURRING", "HOURLY", "CAPPED_FEE", "RETAINER"]).optional(),
  personId: z.string().optional(),
  description: z.string(),
  quantity: z.number().optional(),
  rate: z.number().optional(),
  unitPrice: z.number().optional(),
  discountPercent: z.number().optional(),
  discountAmount: z.number().optional(),
  amount: z.number(),
  date: z.string().optional(),
  expenseId: z.string().optional(), // Reference to ProjectExpense if this is an expense line item
  milestoneIds: z.array(z.string()).optional(), // Array of milestone IDs assigned to this item
  // Recurring payment fields (for item-level recurring)
  recurringEnabled: z.boolean().optional(),
  recurringFrequency: z.enum(["MONTHLY_1", "MONTHLY_3", "MONTHLY_6", "YEARLY_12", "CUSTOM"]).optional(),
  recurringCustomMonths: z.number().optional(),
  recurringStartDate: z.string().optional(),
  // Estimate and capped flags
  isEstimate: z.boolean().optional(),
  isCapped: z.boolean().optional(),
  cappedHours: z.number().optional(),
  cappedAmount: z.number().optional(),
  // Expense flag
  isEstimated: z.boolean().optional(),
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
  upfrontType: z.enum(["PERCENT", "FIXED_AMOUNT"]).nullable().optional(),
  upfrontValue: z.number().nullable().optional(),
  installmentType: z.enum(["TIME_BASED", "MILESTONE_BASED"]).nullable().optional(),
  installmentCount: z.number().nullable().optional(),
  installmentFrequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY"]).nullable().optional(),
  milestoneIds: z.array(z.string()).optional(),
  // Balance payment fields
  balancePaymentType: z.enum(["MILESTONE_BASED", "TIME_BASED", "FULL_UPFRONT"]).nullable().optional(),
  balanceDueDate: z.string().nullable().optional(), // ISO date string
  // Installment maturity dates (custom dates for each installment)
  installmentMaturityDates: z.array(z.string()).optional(), // Array of ISO date strings
  // Recurring payment fields
  recurringEnabled: z.boolean().nullable().optional(),
  recurringFrequency: z.enum(["MONTHLY_1", "MONTHLY_3", "MONTHLY_6", "YEARLY_12", "CUSTOM"]).nullable().optional(),
  recurringCustomMonths: z.number().nullable().optional(),
  recurringStartDate: z.string().nullable().optional(), // ISO date string
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
  hourlyRateTableType: z.enum(["FIXED_RATE", "RATE_RANGE", "HOURLY_TABLE"]).optional(),
  hourlyRateTableRates: z.any().optional(), // JSON object
  retainerMonthlyAmount: z.number().optional(),
  retainerHoursPerMonth: z.number().optional(),
  retainerAdditionalHoursType: z.enum(["FIXED_RATE", "RATE_RANGE", "HOURLY_TABLE"]).optional(),
  retainerAdditionalHoursRate: z.number().optional(),
  retainerAdditionalHoursRateMin: z.number().optional(),
  retainerAdditionalHoursRateMax: z.number().optional(),
  retainerAdditionalHoursBlendedRate: z.number().optional(),
  retainerStartDate: z.string().optional(),
  retainerDurationMonths: z.number().nullable().optional(),
  retainerProjectScope: z.enum(["ALL_PROJECTS", "SPECIFIC_PROJECTS"]).optional(),
  retainerProjectIds: z.array(z.string()).optional(),
  retainerExcessBillingType: z.enum(["ADDITIONAL_HOURS_RATE", "STANDARD_HOURLY_RATES", "BLENDED_RATE"]).nullable().optional(),
  retainerUnusedBalancePolicy: z.enum(["EXPIRE", "ROLLOVER"]).optional(),
  retainerUnusedBalanceExpiryMonths: z.number().nullable().optional(),
  retainerHourlyTableRates: z.any().optional(), // JSON object
  blendedRate: z.number().optional(),
  useBlendedRate: z.boolean().optional(),
  successFeePercent: z.number().optional(),
  successFeeAmount: z.number().optional(),
  successFeeValue: z.number().optional(),
  successFeeBaseType: z.enum(["FIXED_AMOUNT", "HOURLY_RATE"]).optional(),
  successFeeBaseAmount: z.number().optional(),
  successFeeBaseHourlyRate: z.number().optional(),
  successFeeBaseHourlyDescription: z.string().optional(),
  successFeeType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]).optional(),
  hourlyIsEstimate: z.boolean().optional(),
  hourlyIsCapped: z.boolean().optional(),
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
    const archived = searchParams.get("archived") === "true" // Include archived if explicitly requested
    
    // Pagination parameters
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    const where: any = {
      deletedAt: null, // Exclude deleted items
    }
    // Exclude archived proposals by default, unless explicitly requested
    if (!archived) {
      where.archivedAt = null
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

    const [proposals, total] = await Promise.all([
      prisma.proposal.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { issueDate: { sort: 'desc', nulls: 'last' } },
          { createdAt: "desc" }
        ],
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          type: true,
          clientApprovalStatus: true,
          amount: true,
          proposalNumber: true,
          createdAt: true,
          deletedAt: true,
          archivedAt: true,
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
          customTags: true, // Include customTags field
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
      }),
      prisma.proposal.count({ where })
    ])

    // Ensure all proposals have tags and customTags as arrays
    const normalizedProposals = proposals.map((proposal: any) => ({
      ...proposal,
      tags: Array.isArray(proposal.tags) ? proposal.tags : [],
      customTags: Array.isArray(proposal.customTags) ? proposal.customTags : [],
    }))

    return NextResponse.json({
      data: normalizedProposals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error: any) {
    console.error("Error fetching proposals:", error)
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
    })
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
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
      const issueDate = parseLocalDate(validatedData.issueDate)
      const expiryDate = parseLocalDate(validatedData.expiryDate)
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
        issueDate: validatedData.issueDate ? parseLocalDate(validatedData.issueDate) : null,
        expiryDate: validatedData.expiryDate ? parseLocalDate(validatedData.expiryDate) : null,
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
      hourlyRateTableType: validatedData.hourlyRateTableType || null,
      hourlyRateTableRates: validatedData.hourlyRateTableRates || null,
      retainerMonthlyAmount: validatedData.retainerMonthlyAmount || null,
        retainerHoursPerMonth: validatedData.retainerHoursPerMonth || null,
        retainerAdditionalHoursType: validatedData.retainerAdditionalHoursType || null,
        retainerAdditionalHoursRate: validatedData.retainerAdditionalHoursRate || null,
        retainerAdditionalHoursRateMin: validatedData.retainerAdditionalHoursRateMin || null,
        retainerAdditionalHoursRateMax: validatedData.retainerAdditionalHoursRateMax || null,
        retainerAdditionalHoursBlendedRate: validatedData.retainerAdditionalHoursBlendedRate || null,
        retainerStartDate: validatedData.retainerStartDate ? parseLocalDate(validatedData.retainerStartDate) : null,
        retainerDurationMonths: validatedData.retainerDurationMonths ?? null,
        retainerProjectScope: validatedData.retainerProjectScope || null,
        retainerProjectIds: validatedData.retainerProjectIds || [],
        retainerExcessBillingType: validatedData.retainerExcessBillingType || null,
        retainerUnusedBalancePolicy: validatedData.retainerUnusedBalancePolicy || null,
        retainerUnusedBalanceExpiryMonths: validatedData.retainerUnusedBalanceExpiryMonths ?? null,
        retainerHourlyTableRates: validatedData.retainerHourlyTableRates ? JSON.parse(JSON.stringify(validatedData.retainerHourlyTableRates)) : null,
        blendedRate: validatedData.blendedRate || null,
        useBlendedRate: validatedData.useBlendedRate ?? false,
        successFeePercent: validatedData.successFeePercent || null,
        successFeeAmount: validatedData.successFeeAmount || null,
        successFeeValue: validatedData.successFeeValue || null,
        successFeeBaseType: validatedData.successFeeBaseType || null,
        successFeeBaseAmount: validatedData.successFeeBaseAmount || null,
        successFeeBaseHourlyRate: validatedData.successFeeBaseHourlyRate || null,
        successFeeBaseHourlyDescription: validatedData.successFeeBaseHourlyDescription || null,
        successFeeType: validatedData.successFeeType || null,
        hourlyIsEstimate: validatedData.hourlyIsEstimate ?? false,
        hourlyIsCapped: validatedData.hourlyIsCapped ?? false,
        fixedAmount: validatedData.fixedAmount || null,
        outOfScopeHourlyRate: validatedData.outOfScopeHourlyRate || null,
        customTags: validatedData.customTags || [],
        status: ProposalStatus.DRAFT,
        // Recurring payment fields
        recurringEnabled: validatedData.recurringEnabled ?? false,
        recurringFrequency: validatedData.recurringFrequency || null,
        recurringCustomMonths: validatedData.recurringCustomMonths || null,
        recurringStartDate: validatedData.recurringStartDate ? parseLocalDate(validatedData.recurringStartDate) : null,
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
            dueDate: milestone.dueDate ? parseLocalDate(milestone.dueDate) : null,
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
            expenseId: item.expenseId || null,
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
            recurringStartDate: item.recurringStartDate ? parseLocalDate(item.recurringStartDate) : null,
            // Estimate and capped fields
            isEstimate: item.isEstimate ?? false,
            isCapped: item.isCapped ?? false,
            cappedHours: item.cappedHours || null,
            cappedAmount: item.cappedAmount || null,
            // Expense flag
            isEstimated: item.isEstimated ?? false,
            milestones: actualMilestoneIds.length > 0 ? {
              connect: actualMilestoneIds.map(id => ({ id })),
            } : undefined,
          },
        })
      }
    }

    // Create payment terms after proposal and items are created
    // Payment terms are mandatory - ensure at least one proposal-level term exists
    const createdItems = await prisma.proposalItem.findMany({
      where: { proposalId: proposal.id },
      orderBy: { createdAt: "asc" },
    })

    // Helper function to create default payment terms (one-time payment, no recurring)
    const getDefaultPaymentTerm = (): any => {
      return {
        proposalId: proposal.id,
        proposalItemId: null, // Proposal-level
        upfrontType: null,
        upfrontValue: null,
        balancePaymentType: null,
        installmentType: null,
        installmentCount: null,
        installmentFrequency: null,
        milestoneIds: [],
        balanceDueDate: null,
        installmentMaturityDates: [],
        recurringEnabled: false,
        recurringFrequency: null,
        recurringCustomMonths: null,
        recurringStartDate: null,
      }
    }

    // Check if we have valid payment terms with at least one proposal-level term
    const hasProposalLevelTerm = validatedData.paymentTerms && 
      Array.isArray(validatedData.paymentTerms) && 
      validatedData.paymentTerms.some(term => term && !term.proposalItemId)

    // Filter out null/undefined terms and only keep terms with actual data
    // A term is valid if it has any payment configuration (even if recurringEnabled is explicitly false)
    let validPaymentTerms = validatedData.paymentTerms && Array.isArray(validatedData.paymentTerms)
      ? validatedData.paymentTerms.filter(term => 
          term && (
            term.upfrontType !== null && term.upfrontType !== undefined ||
            term.upfrontValue !== null && term.upfrontValue !== undefined ||
            term.installmentType !== null && term.installmentType !== undefined ||
            term.balancePaymentType !== null && term.balancePaymentType !== undefined ||
            term.balanceDueDate !== null && term.balanceDueDate !== undefined ||
            term.recurringEnabled === true || // Explicitly enabled
            term.recurringEnabled === false // Explicitly disabled (still valid)
          )
        )
      : []

    // If no proposal-level payment terms exist, create default
    if (!hasProposalLevelTerm || validPaymentTerms.length === 0) {
      const defaultTerm = getDefaultPaymentTerm()
      validPaymentTerms = [defaultTerm]
    } else {
      // Ensure we have at least one proposal-level term
      const proposalLevelTerms = validPaymentTerms.filter(term => !term.proposalItemId)
      if (proposalLevelTerms.length === 0) {
        // Add default as first term
        validPaymentTerms = [getDefaultPaymentTerm(), ...validPaymentTerms]
      }
    }

    // Always create payment terms (mandatory)
    const paymentTermsToCreate = validPaymentTerms.map((term) => {
      // Determine if this is a proposal-level term (no proposalItemId) or item-level
      const isProposalLevel = !term.proposalItemId
      
      // For item-level terms, find the matching item
      let proposalItemId: string | null = null
      if (!isProposalLevel && term.proposalItemId) {
        // Try to find item by the provided proposalItemId (might be a temp ID or actual ID)
        const matchingItem = createdItems.find(item => item.id === term.proposalItemId)
        proposalItemId = matchingItem?.id || null
      }
      
      return {
        proposalId: proposal.id,
        proposalItemId: isProposalLevel ? null : proposalItemId,
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
        recurringStartDate: term.recurringStartDate ? parseLocalDate(term.recurringStartDate) : null,
      }
    })

    // Always create payment terms (mandatory)
    if (paymentTermsToCreate.length > 0) {
      await prisma.paymentTerm.createMany({
        data: paymentTermsToCreate,
      })
    } else {
      // Fallback: create default payment terms if somehow we got here
      const defaultTerm = getDefaultPaymentTerm()
      await prisma.paymentTerm.create({
        data: defaultTerm,
      })
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



