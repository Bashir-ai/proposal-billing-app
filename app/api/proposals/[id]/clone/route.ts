export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ProposalStatus } from "@prisma/client"
import { generateProposalNumber } from "@/lib/proposal-number"

const cloneSchema = z.object({
  copyClient: z.boolean().optional(),
  copyBillingMethod: z.boolean().optional(),
  copyLineItems: z.boolean().optional(),
  copyMilestones: z.boolean().optional(),
  copyPaymentTerms: z.boolean().optional(),
  copyTags: z.boolean().optional(),
  copyDescription: z.boolean().optional(),
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

    const originalProposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            person: {
              select: {
                id: true,
                name: true,
              },
            },
            milestones: {
              select: {
                id: true,
              },
            },
          },
        },
        milestones: true,
        tags: true,
        paymentTerms: true,
      },
    })

    if (!originalProposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    const body = await request.json()
    const options = cloneSchema.parse(body)

    // Generate new proposal number
    const proposalNumber = await generateProposalNumber()
    const today = new Date() // Use Date object for Prisma DateTime

    // First, create the cloned proposal without items/milestones (to get IDs)
    // Then we'll create milestones and connect them to items
    const clonedProposal = await prisma.proposal.create({
      data: {
        clientId: options.copyClient ? originalProposal.clientId : originalProposal.clientId, // Still need a client, use original for now
        createdBy: session.user.id,
        type: options.copyBillingMethod ? originalProposal.type : originalProposal.type,
        title: `${originalProposal.title} (Copy)`,
        description: options.copyDescription ? originalProposal.description : null,
        proposalNumber,
        issueDate: today,
        expiryDate: null, // Reset expiry date
        currency: originalProposal.currency,
        taxInclusive: originalProposal.taxInclusive,
        taxRate: originalProposal.taxRate,
        clientDiscountPercent: originalProposal.clientDiscountPercent,
        clientDiscountAmount: originalProposal.clientDiscountAmount,
        estimatedHours: options.copyBillingMethod ? originalProposal.estimatedHours : null,
        hourlyRateRangeMin: options.copyBillingMethod ? originalProposal.hourlyRateRangeMin : null,
        hourlyRateRangeMax: options.copyBillingMethod ? originalProposal.hourlyRateRangeMax : null,
        cappedAmount: options.copyBillingMethod ? originalProposal.cappedAmount : null,
        retainerMonthlyAmount: options.copyBillingMethod ? originalProposal.retainerMonthlyAmount : null,
        retainerHourlyCap: options.copyBillingMethod ? originalProposal.retainerHourlyCap : null,
        blendedRate: options.copyBillingMethod ? originalProposal.blendedRate : null,
        successFeePercent: options.copyBillingMethod ? originalProposal.successFeePercent : null,
        successFeeAmount: options.copyBillingMethod ? originalProposal.successFeeAmount : null,
        successFeeValue: options.copyBillingMethod ? originalProposal.successFeeValue : null,
        fixedAmount: options.copyBillingMethod ? originalProposal.fixedAmount : null,
        outOfScopeHourlyRate: options.copyBillingMethod ? originalProposal.outOfScopeHourlyRate : null,
        customTags: options.copyTags ? originalProposal.customTags : [],
        status: ProposalStatus.DRAFT,
        tags: options.copyTags && originalProposal.tags.length > 0 ? {
          connect: originalProposal.tags.map(tag => ({ id: tag.id })),
        } : undefined,
        items: undefined, // Will create items after milestones to connect them
        milestones: undefined, // Will create milestones first, then items
        paymentTerms: undefined, // Will create after milestones to map milestone IDs
      },
      include: {
        client: true,
        items: true,
        milestones: true,
        tags: true,
      },
    })

    // Create milestones first (if needed) to get their IDs for connecting to items
    const milestoneIdMap = new Map<string, string>() // old milestone ID -> new milestone ID
    if (options.copyMilestones && originalProposal.milestones.length > 0) {
      for (const originalMilestone of originalProposal.milestones) {
        const newMilestone = await prisma.milestone.create({
          data: {
            proposalId: clonedProposal.id,
            name: originalMilestone.name,
            description: originalMilestone.description,
            amount: originalMilestone.amount,
            percent: originalMilestone.percent,
            dueDate: originalMilestone.dueDate,
          },
        })
        milestoneIdMap.set(originalMilestone.id, newMilestone.id)
      }
    }

    // Create line items and connect them to cloned milestones
    if (options.copyLineItems && originalProposal.items.length > 0) {
      for (const originalItem of originalProposal.items) {
        // Get the new milestone IDs for this item
        const newMilestoneIds = originalItem.milestones
          .map(m => milestoneIdMap.get(m.id))
          .filter((id): id is string => id !== undefined)

        const newItem = await prisma.proposalItem.create({
          data: {
            proposalId: clonedProposal.id,
            billingMethod: originalItem.billingMethod,
            personId: originalItem.personId,
            description: originalItem.description,
            quantity: originalItem.quantity,
            rate: originalItem.rate,
            unitPrice: originalItem.unitPrice,
            discountPercent: originalItem.discountPercent,
            discountAmount: originalItem.discountAmount,
            amount: originalItem.amount,
            date: originalItem.date,
            milestones: newMilestoneIds.length > 0 ? {
              connect: newMilestoneIds.map(id => ({ id })),
            } : undefined,
          },
        })
      }
    }

    // Create payment terms with mapped milestone IDs
    if (options.copyPaymentTerms && originalProposal.paymentTerms.length > 0) {
      for (const originalTerm of originalProposal.paymentTerms) {
        // Map milestone IDs to new milestone IDs
        const newMilestoneIds = originalTerm.milestoneIds
          .map(oldId => milestoneIdMap.get(oldId))
          .filter((id): id is string => id !== undefined)

        await prisma.paymentTerm.create({
          data: {
            proposalId: clonedProposal.id,
            proposalItemId: null, // Payment terms at proposal level don't have proposalItemId
            upfrontType: originalTerm.upfrontType,
            upfrontValue: originalTerm.upfrontValue,
            installmentType: originalTerm.installmentType,
            installmentCount: originalTerm.installmentCount,
            installmentFrequency: originalTerm.installmentFrequency,
            milestoneIds: newMilestoneIds,
          },
        })
      }
    }

    // Fetch the complete cloned proposal with all relations
    const completeClonedProposal = await prisma.proposal.findUnique({
      where: { id: clonedProposal.id },
      include: {
        client: true,
        items: {
          include: {
            milestones: true,
          },
        },
        milestones: true,
        tags: true,
        paymentTerms: true,
      },
    })

    return NextResponse.json(completeClonedProposal, { status: 201 })
  } catch (error: any) {
    console.error("Error cloning proposal:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    // Check for Prisma errors
    if (error.code) {
      return NextResponse.json(
        { 
          error: "Database error", 
          message: error.message,
          code: error.code 
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        error: "Internal server error",
        message: error.message || "An unexpected error occurred"
      },
      { status: 500 }
    )
  }
}


