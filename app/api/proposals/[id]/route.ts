export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ProposalType, ProposalStatus } from "@prisma/client"
import { canEditProposal } from "@/lib/permissions"

const proposalItemSchema = z.object({
  id: z.string().optional(),
  billingMethod: z.enum(["FIXED_FEE", "SUCCESS_FEE", "RECURRING", "HOURLY", "CAPPED_FEE", "RETAINER"]).optional(),
  personId: z.string().optional(),
  expenseId: z.string().optional(), // Reference to ProjectExpense if this is an expense line item
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
  // Estimate and capped flags
  isEstimate: z.boolean().optional(),
  isCapped: z.boolean().optional(),
  cappedHours: z.number().optional(),
  cappedAmount: z.number().optional(),
  // Expense flag
  isEstimated: z.boolean().optional(),
})

const milestoneSchema = z.object({
  id: z.string().optional(), // DB ID for existing milestones, temp ID for new ones
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

const proposalUpdateSchema = z.object({
  clientId: z.string().optional(),
  leadId: z.string().optional(),
  type: z.nativeEnum(ProposalType).optional(),
  title: z.string().min(1).optional().or(z.literal("")),
  description: z.string().optional(),
  amount: z.number().optional(),
  proposalNumber: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  currency: z.string().optional(),
  taxInclusive: z.boolean().optional(),
  taxRate: z.number().optional(),
  clientDiscountPercent: z.number().optional(),
  clientDiscountAmount: z.number().optional(),
  estimatedHours: z.number().optional(),
  hourlyRateRangeMin: z.number().optional(),
  hourlyRateRangeMax: z.number().optional(),
  hourlyCapHours: z.number().optional(),
  cappedAmount: z.number().optional(),
  retainerMonthlyAmount: z.number().optional(),
  retainerHoursPerMonth: z.number().optional(),
  retainerAdditionalHoursType: z.enum(["FIXED_RATE", "RATE_RANGE", "BLENDED_RATE"]).optional(),
  retainerAdditionalHoursRate: z.number().optional(),
  retainerAdditionalHoursRateMin: z.number().optional(),
  retainerAdditionalHoursRateMax: z.number().optional(),
  retainerAdditionalHoursBlendedRate: z.number().optional(),
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
  status: z.nativeEnum(ProposalStatus).optional(),
  items: z.array(proposalItemSchema).optional(),
  milestones: z.array(milestoneSchema).optional(),
  paymentTerms: z.array(paymentTermSchema).optional(),
  // Recurring payment fields (proposal-level)
  recurringEnabled: z.boolean().optional(),
  recurringFrequency: z.enum(["MONTHLY_1", "MONTHLY_3", "MONTHLY_6", "YEARLY_12", "CUSTOM"]).optional(),
  recurringCustomMonths: z.number().optional(),
  recurringStartDate: z.string().optional(),
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

    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        client: true,
        lead: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
          },
        },
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
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
          orderBy: { createdAt: "asc" },
        },
        milestones: {
          orderBy: { createdAt: "asc" },
        },
        tags: true,
        paymentTerms: true,
        approvals: {
          include: {
            approver: {
              select: {
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        bills: true,
      },
    })

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    // Check if client can access this proposal
    if (session.user.role === "CLIENT") {
      const client = await prisma.client.findFirst({
        where: { 
          email: session.user.email,
          deletedAt: null, // Exclude deleted clients
        },
      })
      if (!client || proposal.clientId !== client.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    return NextResponse.json(proposal)
  } catch (error) {
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

    const proposal = await prisma.proposal.findUnique({
      where: { id },
    })

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    // Check edit permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        canEditAllProposals: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (!canEditProposal(user, { createdBy: proposal.createdBy, status: proposal.status })) {
      return NextResponse.json(
        { error: "You don't have permission to edit this proposal" },
        { status: 403 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch (parseError: any) {
      console.error("PUT /api/proposals/[id] - Error parsing request body:", parseError?.message || String(parseError))
      return NextResponse.json(
        { error: "Invalid JSON in request body", message: parseError?.message || "Failed to parse request body" },
        { status: 400 }
      )
    }

    let validatedData
    try {
      validatedData = proposalUpdateSchema.parse(body)
    } catch (validationError: any) {
      console.error("PUT /api/proposals/[id] - Validation error:", validationError?.message || String(validationError))
      if (validationError instanceof z.ZodError) {
        return NextResponse.json(
          { 
            error: "Invalid input", 
            details: validationError.errors,
            message: validationError.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; ")
          },
          { status: 400 }
        )
      }
      throw validationError
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

    // Validate that either clientId or leadId is provided, but not both (if either is being updated)
    if ((validatedData.clientId !== undefined || validatedData.leadId !== undefined)) {
      // Get current proposal to check existing values
      const currentProposal = await prisma.proposal.findUnique({
        where: { id },
        select: { clientId: true, leadId: true },
      })

      const newClientId = validatedData.clientId !== undefined ? validatedData.clientId : currentProposal?.clientId
      const newLeadId = validatedData.leadId !== undefined ? validatedData.leadId : currentProposal?.leadId

      if (!newClientId && !newLeadId) {
        return NextResponse.json(
          { error: "Either clientId or leadId must be provided" },
          { status: 400 }
        )
      }

      if (newClientId && newLeadId) {
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
    }

    // Prepare update data
    const updateData: any = {}
    try {
      if (validatedData.clientId !== undefined) updateData.clientId = validatedData.clientId || null
      if (validatedData.leadId !== undefined) updateData.leadId = validatedData.leadId || null
      if (validatedData.type !== undefined) updateData.type = validatedData.type
      if (validatedData.title !== undefined) updateData.title = validatedData.title
      if (validatedData.description !== undefined) updateData.description = validatedData.description
      if (validatedData.amount !== undefined) updateData.amount = validatedData.amount
      if (validatedData.proposalNumber !== undefined) updateData.proposalNumber = validatedData.proposalNumber
      if (validatedData.issueDate !== undefined) updateData.issueDate = validatedData.issueDate ? new Date(validatedData.issueDate) : null
      if (validatedData.expiryDate !== undefined) updateData.expiryDate = validatedData.expiryDate ? new Date(validatedData.expiryDate) : null
      if (validatedData.currency !== undefined) updateData.currency = validatedData.currency
      if (validatedData.taxInclusive !== undefined) updateData.taxInclusive = validatedData.taxInclusive
      if (validatedData.taxRate !== undefined) updateData.taxRate = validatedData.taxRate || null
      if (validatedData.clientDiscountPercent !== undefined) updateData.clientDiscountPercent = validatedData.clientDiscountPercent || null
      if (validatedData.clientDiscountAmount !== undefined) updateData.clientDiscountAmount = validatedData.clientDiscountAmount || null
      if (validatedData.estimatedHours !== undefined) updateData.estimatedHours = validatedData.estimatedHours || null
      if (validatedData.hourlyRateRangeMin !== undefined) updateData.hourlyRateRangeMin = validatedData.hourlyRateRangeMin || null
      if (validatedData.hourlyRateRangeMax !== undefined) updateData.hourlyRateRangeMax = validatedData.hourlyRateRangeMax || null
      if (validatedData.hourlyCapHours !== undefined) updateData.hourlyCapHours = validatedData.hourlyCapHours || null
      if (validatedData.cappedAmount !== undefined) updateData.cappedAmount = validatedData.cappedAmount || null
      if (validatedData.retainerMonthlyAmount !== undefined) updateData.retainerMonthlyAmount = validatedData.retainerMonthlyAmount || null
      if (validatedData.retainerHoursPerMonth !== undefined) updateData.retainerHoursPerMonth = validatedData.retainerHoursPerMonth || null
      if (validatedData.retainerAdditionalHoursType !== undefined) updateData.retainerAdditionalHoursType = validatedData.retainerAdditionalHoursType || null
      if (validatedData.retainerAdditionalHoursRate !== undefined) updateData.retainerAdditionalHoursRate = validatedData.retainerAdditionalHoursRate || null
      if (validatedData.retainerAdditionalHoursRateMin !== undefined) updateData.retainerAdditionalHoursRateMin = validatedData.retainerAdditionalHoursRateMin || null
      if (validatedData.retainerAdditionalHoursRateMax !== undefined) updateData.retainerAdditionalHoursRateMax = validatedData.retainerAdditionalHoursRateMax || null
      if (validatedData.retainerAdditionalHoursBlendedRate !== undefined) updateData.retainerAdditionalHoursBlendedRate = validatedData.retainerAdditionalHoursBlendedRate || null
      if (validatedData.blendedRate !== undefined) updateData.blendedRate = validatedData.blendedRate || null
      if (validatedData.useBlendedRate !== undefined) updateData.useBlendedRate = validatedData.useBlendedRate
      if (validatedData.successFeePercent !== undefined) updateData.successFeePercent = validatedData.successFeePercent || null
      if (validatedData.successFeeAmount !== undefined) updateData.successFeeAmount = validatedData.successFeeAmount || null
      if (validatedData.successFeeValue !== undefined) updateData.successFeeValue = validatedData.successFeeValue || null
      if (validatedData.successFeeBaseType !== undefined) updateData.successFeeBaseType = validatedData.successFeeBaseType || null
      if (validatedData.successFeeBaseAmount !== undefined) updateData.successFeeBaseAmount = validatedData.successFeeBaseAmount || null
      if (validatedData.successFeeBaseHourlyRate !== undefined) updateData.successFeeBaseHourlyRate = validatedData.successFeeBaseHourlyRate || null
      if (validatedData.successFeeBaseHourlyDescription !== undefined) updateData.successFeeBaseHourlyDescription = validatedData.successFeeBaseHourlyDescription || null
      if (validatedData.successFeeType !== undefined) updateData.successFeeType = validatedData.successFeeType || null
      if (validatedData.hourlyIsEstimate !== undefined) updateData.hourlyIsEstimate = validatedData.hourlyIsEstimate
      if (validatedData.hourlyIsCapped !== undefined) updateData.hourlyIsCapped = validatedData.hourlyIsCapped
      if (validatedData.fixedAmount !== undefined) updateData.fixedAmount = validatedData.fixedAmount || null
      if (validatedData.outOfScopeHourlyRate !== undefined) updateData.outOfScopeHourlyRate = validatedData.outOfScopeHourlyRate || null
      if (validatedData.status !== undefined) updateData.status = validatedData.status
      if (validatedData.customTags !== undefined) updateData.customTags = validatedData.customTags
      // Recurring payment fields (proposal-level)
      if (validatedData.recurringEnabled !== undefined) updateData.recurringEnabled = validatedData.recurringEnabled
      if (validatedData.recurringFrequency !== undefined) updateData.recurringFrequency = validatedData.recurringFrequency || null
      if (validatedData.recurringCustomMonths !== undefined) updateData.recurringCustomMonths = validatedData.recurringCustomMonths || null
      if (validatedData.recurringStartDate !== undefined) updateData.recurringStartDate = validatedData.recurringStartDate ? new Date(validatedData.recurringStartDate) : null
    } catch (updateDataError: any) {
      console.error("Error building updateData:", updateDataError?.message || String(updateDataError))
      throw new Error(`Failed to prepare update data: ${updateDataError?.message || String(updateDataError)}`)
    }

    // Update proposal
    await prisma.proposal.update({
      where: { id },
      data: {
        ...updateData,
        tags: validatedData.tagIds !== undefined ? {
          set: validatedData.tagIds.map(tagId => ({ id: tagId })),
        } : undefined,
      },
    })

    // Update milestones first (need their IDs for item assignments)
    const milestoneIdMap = new Map<string, string>()
    if (validatedData.milestones) {
      try {
        // Get existing milestones to preserve IDs for updates
        const existingMilestones = await prisma.milestone.findMany({
          where: { proposalId: id },
        })

        // Build map of existing milestone IDs by name (for matching)
        const existingMilestoneMap = new Map<string, string>()
        existingMilestones.forEach(m => {
          if (m.id) existingMilestoneMap.set(m.id, m.id)
        })

        // Delete all existing milestones (will recreate with assignments)
        await prisma.milestone.deleteMany({
          where: { proposalId: id },
        })

        // Create/update milestones and build ID map
        if (validatedData.milestones.length > 0) {
          for (const milestone of validatedData.milestones) {
            // Check if this is an existing milestone (has DB ID that starts with 'cl' or similar)
            const isExisting = milestone.id && !milestone.id.startsWith("temp-") && existingMilestoneMap.has(milestone.id)
            
            let createdMilestone
            if (isExisting && milestone.id) {
              // Recreate with same ID if it was an existing one
              createdMilestone = await prisma.milestone.create({
                data: {
                  id: milestone.id, // Preserve ID if it was existing
                  proposalId: id,
                  name: milestone.name,
                  description: milestone.description || null,
                  amount: milestone.amount || null,
                  percent: milestone.percent || null,
                  dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
                },
              })
            } else {
              // Create new milestone
              createdMilestone = await prisma.milestone.create({
                data: {
                  proposalId: id,
                  name: milestone.name,
                  description: milestone.description || null,
                  amount: milestone.amount || null,
                  percent: milestone.percent || null,
                  dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
                },
              })
            }
            
            // Map temporary ID to actual DB ID
            if (milestone.id) {
              milestoneIdMap.set(milestone.id, createdMilestone.id)
            }
          }
        }
      } catch (milestonesError: any) {
        console.error("Error updating milestones:", milestonesError?.message || String(milestonesError))
        throw milestonesError
      }
    } else {
      // If no milestones provided, get existing ones for ID mapping
      const existingMilestones = await prisma.milestone.findMany({
        where: { proposalId: id },
      })
      existingMilestones.forEach(m => {
        if (m.id) milestoneIdMap.set(m.id, m.id)
      })
    }

    // Update items if provided
    if (validatedData.items && Array.isArray(validatedData.items)) {
      try {
        // Delete existing items (cascade will handle milestone relations)
        await prisma.proposalItem.deleteMany({
          where: { proposalId: id },
        })

        // Create new items with milestone assignments
        if (validatedData.items.length > 0) {
          for (const item of validatedData.items) {
            // Map temporary milestone IDs to actual DB IDs
            const actualMilestoneIds = (item.milestoneIds || [])
              .map(tempId => milestoneIdMap.get(tempId))
              .filter((id): id is string => id !== undefined)

            await prisma.proposalItem.create({
              data: {
                proposalId: id,
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
                recurringStartDate: item.recurringStartDate ? new Date(item.recurringStartDate) : null,
                milestones: actualMilestoneIds.length > 0 ? {
                  connect: actualMilestoneIds.map(id => ({ id })),
                } : undefined,
              },
            })
          }
        }
      } catch (itemsError: any) {
        console.error("Error updating items:", itemsError?.message || String(itemsError))
        throw itemsError
      }
    }

    // Update payment terms - mandatory, so always process
    try {
      // Delete existing payment terms
      await prisma.paymentTerm.deleteMany({
        where: { proposalId: id },
      })

      // Get created/updated items (after they've been created/updated)
      const existingItems = await prisma.proposalItem.findMany({
        where: { proposalId: id },
        orderBy: { createdAt: "asc" },
      })

      // Helper function to create default payment terms (one-time payment, no recurring)
      const getDefaultPaymentTerm = (): any => {
        return {
          proposalId: id,
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

      // Create new payment terms
      const paymentTermsToCreate: any[] = []
      
      validPaymentTerms.forEach((term) => {
        // Determine if this is a proposal-level term (no proposalItemId) or item-level
        const isProposalLevel = !term.proposalItemId
        
        // For item-level terms, find the matching item
        let proposalItemId: string | null = null
        if (!isProposalLevel && term.proposalItemId) {
          const matchingItem = existingItems.find(item => item.id === term.proposalItemId)
          proposalItemId = matchingItem?.id || null
        }
        
        paymentTermsToCreate.push({
          proposalId: id,
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
          recurringStartDate: term.recurringStartDate ? new Date(term.recurringStartDate) : null,
        })
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
    } catch (paymentTermsError: any) {
      console.error("Error updating payment terms:", paymentTermsError?.message || String(paymentTermsError))
      // Payment terms are mandatory, so if update fails, try to create default
      try {
        const now = new Date()
        const day = now.getDate()
        let startDate: Date
        if (day < 15) {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        } else {
          startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        }
        await prisma.paymentTerm.create({
          data: {
            proposalId: id,
            proposalItemId: null,
            recurringEnabled: true,
            recurringFrequency: "MONTHLY_1",
            recurringStartDate: startDate,
          },
        })
      } catch (fallbackError) {
        console.error("Failed to create default payment terms:", fallbackError)
        // Don't fail the entire update - payment terms will be missing but proposal update succeeds
      }
    }

    const finalProposal = await prisma.proposal.findUnique({
      where: { id },
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

    return NextResponse.json(finalProposal)
  } catch (error: any) {
    console.error("PUT /api/proposals/[id] - ERROR CAUGHT:", error?.message || String(error))
    console.error("Error type:", error?.constructor?.name || "Unknown")
    
    if (error instanceof z.ZodError) {
      console.error("Validation error updating proposal:", error.errors)
      return NextResponse.json(
        { 
          error: "Invalid input", 
          details: error.errors,
          message: error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; ")
        },
        { status: 400 }
      )
    }

    // Log detailed error information safely
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCode = error?.code || "UNKNOWN"
    
    // Safely log error details without trying to inspect problematic objects
    console.error("Error details:", { message: errorMessage, code: errorCode })
    if (error?.stack) {
      console.error("Error stack:", error.stack)
    }

    // Check if it's a Prisma error about missing field
    if (errorCode === "P2025" || errorMessage?.includes("Unknown field")) {
      return NextResponse.json(
        { 
          error: "Database schema mismatch", 
          message: "The database schema may be out of date. Please run: npx prisma db push",
          details: errorMessage
        },
        { status: 500 }
      )
    }

    // Check if it's a Prisma validation error
    if (errorCode?.startsWith("P") || errorMessage?.includes("prisma") || errorMessage?.toLowerCase().includes("prisma")) {
      return NextResponse.json(
        { 
          error: "Database error", 
          message: errorMessage,
          code: errorCode
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        error: "Internal server error", 
        message: errorMessage,
        code: errorCode
      },
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

    if (session.user.role === "CLIENT") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        projects: true,
      },
    })

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    // Only allow deletion if proposal hasn't been accepted by client
    if (proposal.clientApprovalStatus === "APPROVED") {
      return NextResponse.json(
        { error: "Cannot delete a proposal that has been accepted by the client" },
        { status: 403 }
      )
    }

    // Check if proposal has associated projects
    if (proposal.projects && proposal.projects.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete a proposal that has been converted to a project" },
        { status: 403 }
      )
    }

    // Only admin can delete
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden. Only admins can delete proposals." },
        { status: 403 }
      )
    }

    // Soft delete: set deletedAt timestamp
    await prisma.proposal.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    })

    return NextResponse.json({ message: "Proposal moved to junk box successfully" })
  } catch (error: any) {
    console.error("Error deleting proposal:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCode = error?.code || "UNKNOWN"
    
    // Check if it's a Prisma error
    if (errorCode?.startsWith("P") || errorMessage?.includes("prisma")) {
      return NextResponse.json(
        { 
          error: "Database error", 
          message: errorMessage,
          code: errorCode
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { error: "Internal server error", message: errorMessage },
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
    const action = body.action

    if (action === "submit") {
      const proposal = await prisma.proposal.update({
        where: { id },
        data: {
          status: ProposalStatus.SUBMITTED,
          submittedAt: new Date(),
        },
      })

      return NextResponse.json(proposal)
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

