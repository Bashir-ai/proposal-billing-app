import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ProposalType, ProposalStatus } from "@prisma/client"
import { generateProposalNumber } from "@/lib/proposal-number"

const proposalItemSchema = z.object({
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
  name: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().optional(),
  percent: z.number().optional(),
  dueDate: z.string().optional(),
})

const paymentTermSchema = z.object({
  upfrontType: z.enum(["PERCENT", "FIXED_AMOUNT"]).optional(),
  upfrontValue: z.number().optional(),
  installmentType: z.enum(["TIME_BASED", "MILESTONE_BASED"]).optional(),
  installmentCount: z.number().optional(),
  installmentFrequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY"]).optional(),
  milestoneIds: z.array(z.string()).optional(),
})

const proposalSchema = z.object({
  clientId: z.string(),
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

    const where: any = {}
    if (status) where.status = status
    if (type) where.type = type
    if (clientId) where.clientId = clientId
    if (session.user.role === "CLIENT") {
      const client = await prisma.client.findFirst({
        where: { email: session.user.email },
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
        items: true,
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

    const proposal = await prisma.proposal.create({
      data: {
        clientId: validatedData.clientId,
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
        tags: validatedData.tagIds ? {
          connect: validatedData.tagIds.map(id => ({ id })),
        } : undefined,
        items: {
          create: validatedData.items?.map((item) => ({
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
          })) || [],
        },
        milestones: {
          create: validatedData.milestones?.map((milestone) => ({
            name: milestone.name,
            description: milestone.description || null,
            amount: milestone.amount || null,
            percent: milestone.percent || null,
            dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
          })) || [],
        },
      },
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
      },
    })

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



