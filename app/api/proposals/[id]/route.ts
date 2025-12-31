import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ProposalType, ProposalStatus } from "@prisma/client"

const proposalItemSchema = z.object({
  id: z.string().optional(),
  billingMethod: z.string().optional(),
  personId: z.string().optional(),
  description: z.string(),
  quantity: z.number().optional(),
  rate: z.number().optional(),
  unitPrice: z.number().optional(),
  discountPercent: z.number().optional(),
  discountAmount: z.number().optional(),
  amount: z.number(),
  date: z.string().optional(),
})

const milestoneSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().optional(),
  percent: z.number().optional(),
  dueDate: z.string().optional(),
})

const paymentTermSchema = z.object({
  upfrontType: z.enum(["PERCENT", "FIXED_AMOUNT"]).optional().nullable(),
  upfrontValue: z.number().optional().nullable(),
  installmentType: z.enum(["TIME_BASED", "MILESTONE_BASED"]).optional().nullable(),
  installmentCount: z.number().optional().nullable(),
  installmentFrequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY"]).optional().nullable(),
  milestoneIds: z.array(z.string()).optional().nullable(),
  proposalItemId: z.string().optional().nullable(),
})

const proposalUpdateSchema = z.object({
  clientId: z.string().optional(),
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
  status: z.nativeEnum(ProposalStatus).optional(),
  items: z.array(proposalItemSchema).optional(),
  milestones: z.array(milestoneSchema).optional(),
  paymentTerms: z.array(paymentTermSchema).optional(),
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
        where: { email: session.user.email },
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
    console.log("PUT /api/proposals/[id] - Starting update for proposal:", id)
    
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

    // Only allow editing drafts
    if (proposal.status !== ProposalStatus.DRAFT && proposal.createdBy !== session.user.id) {
      return NextResponse.json(
        { error: "Can only edit draft proposals" },
        { status: 403 }
      )
    }

    let body
    try {
      body = await request.json()
      console.log("PUT /api/proposals/[id] - Request body received")
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
      console.log("PUT /api/proposals/[id] - Validation passed")
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

    // Prepare update data
    const updateData: any = {}
    try {
      if (validatedData.clientId !== undefined) updateData.clientId = validatedData.clientId
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
      if (validatedData.retainerHourlyCap !== undefined) updateData.retainerHourlyCap = validatedData.retainerHourlyCap || null
    if (validatedData.blendedRate !== undefined) updateData.blendedRate = validatedData.blendedRate || null
    if (validatedData.useBlendedRate !== undefined) updateData.useBlendedRate = validatedData.useBlendedRate
    if (validatedData.successFeePercent !== undefined) updateData.successFeePercent = validatedData.successFeePercent || null
    if (validatedData.successFeeAmount !== undefined) updateData.successFeeAmount = validatedData.successFeeAmount || null
      if (validatedData.successFeeValue !== undefined) updateData.successFeeValue = validatedData.successFeeValue || null
      if (validatedData.fixedAmount !== undefined) updateData.fixedAmount = validatedData.fixedAmount || null
      if (validatedData.outOfScopeHourlyRate !== undefined) updateData.outOfScopeHourlyRate = validatedData.outOfScopeHourlyRate || null
      if (validatedData.status !== undefined) updateData.status = validatedData.status
      if (validatedData.customTags !== undefined) updateData.customTags = validatedData.customTags
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

    // Update items if provided
    if (validatedData.items && Array.isArray(validatedData.items)) {
      try {
        // Delete existing items
        await prisma.proposalItem.deleteMany({
          where: { proposalId: id },
        })

        // Create new items
        if (validatedData.items.length > 0) {
          await prisma.proposalItem.createMany({
            data: validatedData.items.map((item) => ({
              proposalId: id,
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
            })),
          })
        }
      } catch (itemsError: any) {
        console.error("Error updating items:", itemsError?.message || String(itemsError))
        console.error("Items data:", JSON.stringify(validatedData.items, null, 2))
        throw itemsError
      }
    }

    // Update milestones if provided
    if (validatedData.milestones) {
      // Delete existing milestones
      await prisma.milestone.deleteMany({
        where: { proposalId: id },
      })

      // Create new milestones
      await prisma.milestone.createMany({
        data: validatedData.milestones.map((milestone) => ({
          proposalId: id,
          name: milestone.name,
          description: milestone.description || null,
          amount: milestone.amount || null,
          percent: milestone.percent || null,
          dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
        })),
      })
    }

    // Update payment terms if provided
    if (validatedData.paymentTerms && Array.isArray(validatedData.paymentTerms) && validatedData.paymentTerms.length > 0) {
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

        // Create new payment terms
        // Payment terms structure: first term is proposal-level (no proposalItemId), 
        // subsequent terms correspond to items in order
        const paymentTermsToCreate: any[] = []
        
        let itemIndex = 0
        validatedData.paymentTerms.forEach((term, index) => {
          // Skip if term has no data
          if (!term.upfrontType && !term.installmentType) {
            return
          }
          
          // First term without proposalItemId is proposal-level
          const isProposalLevel = index === 0 && !term.proposalItemId
          
          paymentTermsToCreate.push({
            proposalId: id,
            proposalItemId: isProposalLevel ? null : (existingItems[itemIndex]?.id || null),
            upfrontType: term.upfrontType || null,
            upfrontValue: term.upfrontValue || null,
            installmentType: term.installmentType || null,
            installmentCount: term.installmentCount || null,
            installmentFrequency: term.installmentFrequency || null,
            milestoneIds: Array.isArray(term.milestoneIds) ? term.milestoneIds : [],
          })
          
          // Only increment item index for non-proposal-level terms
          if (!isProposalLevel && itemIndex < existingItems.length - 1) {
            itemIndex++
          }
        })

        if (paymentTermsToCreate.length > 0) {
          await prisma.paymentTerm.createMany({
            data: paymentTermsToCreate,
          })
        }
      } catch (paymentTermsError: any) {
        console.error("Error updating payment terms:", paymentTermsError?.message || String(paymentTermsError))
        console.error("Payment terms data:", JSON.stringify(validatedData.paymentTerms, null, 2))
        // Don't fail the entire update if payment terms fail - log and continue
        // The proposal update should still succeed even if payment terms fail
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
      console.error("Validation error updating proposal:", JSON.stringify(error.errors, null, 2))
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
    console.error("Error message:", errorMessage)
    console.error("Error code:", errorCode)
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

    // Only proposal creator or admin can delete
    if (proposal.createdBy !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    // Delete the proposal (cascade will handle related records)
    await prisma.proposal.delete({
      where: { id },
    })

    return NextResponse.json({ message: "Proposal deleted successfully" })
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

