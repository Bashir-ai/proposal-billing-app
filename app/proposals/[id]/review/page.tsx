import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ProposalReviewPage } from "@/components/proposals/ProposalReviewPage"
import { formatCurrency, formatDate } from "@/lib/utils"
import { ProposalStatus, ClientApprovalStatus } from "@prisma/client"

export const dynamic = 'force-dynamic'

async function getCurrencySymbol(currency: string) {
  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    CAD: "C$",
    AUD: "A$",
  }
  return symbols[currency] || currency
}

export default async function ProposalReviewPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { id } = await params
  const { token: rawToken } = await searchParams
  // Decode the token in case it was URL encoded, and trim any whitespace
  const token = rawToken ? decodeURIComponent(rawToken).trim() : null

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Invalid Link</h1>
          <p className="text-gray-600">This proposal review link is invalid. Please use the link provided in your email.</p>
        </div>
      </div>
    )
  }

  try {
    const proposal = await prisma.proposal.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        proposalNumber: true,
        status: true,
        clientApprovalStatus: true,
        clientApprovalToken: true, // Include token for validation
        clientApprovalTokenExpiry: true, // Include expiry for validation
        amount: true,
        currency: true,
        issueDate: true,
        expiryDate: true,
        createdAt: true,
        client: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
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
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
        items: {
          orderBy: { createdAt: "asc" },
        },
        milestones: {
          orderBy: { dueDate: "asc" },
        },
        paymentTerms: {
          where: { proposalItemId: null }, // Proposal-level terms
        },
        tags: true,
      },
    })

    if (!proposal) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Proposal Not Found</h1>
            <p className="text-gray-600">The proposal you are looking for does not exist.</p>
          </div>
        </div>
      )
    }

    // Verify token - trim both tokens to handle any whitespace issues
    const storedToken = proposal.clientApprovalToken?.trim() || ""
    const receivedToken = token?.trim() || ""
    
    console.log("Token validation:", {
      proposalToken: storedToken,
      receivedToken: receivedToken,
      tokensMatch: storedToken === receivedToken,
      tokenLength: receivedToken.length,
      proposalTokenLength: storedToken.length,
      rawTokenFromUrl: rawToken,
    })
    
    if (!storedToken || storedToken !== receivedToken) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Invalid Token</h1>
            <p className="text-gray-600">This approval token is invalid. Please use the link provided in your email.</p>
            <p className="text-xs text-gray-500 mt-2">
              Token mismatch. If this persists, please request a new approval link.
            </p>
          </div>
        </div>
      )
    }

    // Check if token is expired
    if (proposal.clientApprovalTokenExpiry && new Date() > proposal.clientApprovalTokenExpiry) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Token Expired</h1>
            <p className="text-gray-600">This approval link has expired. Please contact us to request a new link.</p>
          </div>
        </div>
      )
    }

    // Check if already approved/rejected
    if (proposal.clientApprovalStatus !== ClientApprovalStatus.PENDING) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">
              {proposal.clientApprovalStatus === ClientApprovalStatus.APPROVED ? "Already Approved" : "Already Rejected"}
            </h1>
            <p className="text-gray-600">
              This proposal has already been {proposal.clientApprovalStatus.toLowerCase()}.
            </p>
          </div>
        </div>
      )
    }

    const currencySymbol = await getCurrencySymbol(proposal.currency)

    return (
      <ProposalReviewPage
        proposal={{
          ...proposal,
          currencySymbol,
        }}
        token={token}
      />
    )
  } catch (error) {
    console.error("Error loading proposal for review:", error)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600">An error occurred while loading the proposal. Please try again later.</p>
        </div>
      </div>
    )
  }
}
