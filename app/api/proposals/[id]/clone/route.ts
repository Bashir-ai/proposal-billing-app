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
    const today = new Date().toISOString().split("T")[0]

    // Create cloned proposal
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
        items: options.copyLineItems && originalProposal.items.length > 0 ? {
          create: originalProposal.items.map(item => ({
            billingMethod: item.billingMethod,
            personId: item.personId,
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent,
            discountAmount: item.discountAmount,
            amount: item.amount,
            date: item.date,
          })),
        } : undefined,
        milestones: options.copyMilestones && originalProposal.milestones.length > 0 ? {
          create: originalProposal.milestones.map(milestone => ({
            name: milestone.name,
            description: milestone.description,
            amount: milestone.amount,
            percent: milestone.percent,
            dueDate: milestone.dueDate,
          })),
        } : undefined,
        paymentTerms: options.copyPaymentTerms && originalProposal.paymentTerms.length > 0 ? {
          create: originalProposal.paymentTerms.map(term => ({
            upfrontType: term.upfrontType,
            upfrontValue: term.upfrontValue,
            installmentType: term.installmentType,
            installmentCount: term.installmentCount,
            installmentFrequency: term.installmentFrequency,
            milestoneIds: term.milestoneIds,
          })),
        } : undefined,
      },
      include: {
        client: true,
        items: true,
        milestones: true,
        tags: true,
      },
    })

    return NextResponse.json(clonedProposal, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


