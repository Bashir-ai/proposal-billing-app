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
}: {
  params: Promise<{ id: string; token: string }>
}) {
  const { id, token: rawToken } = await params
  // Next.js path parameters are already decoded, but handle both cases
  // Try raw token first, then try decoding in case it was double-encoded
  let token: string | null = null
  if (rawToken) {
    const trimmed = rawToken.trim()
    // Hex tokens are URL-safe, so they shouldn't need decoding
    // But try both in case email client or Resend encoded it
    if (/^[0-9a-f]+$/i.test(trimmed)) {
      // Valid hex string, use as-is
      token = trimmed
    } else {
      // Might be encoded, try decoding
      try {
        const decoded = decodeURIComponent(trimmed)
        if (/^[0-9a-f]+$/i.test(decoded)) {
          token = decoded
        } else {
          token = trimmed // Use as-is if decoding doesn't help
        }
      } catch {
        token = trimmed // Use as-is if decoding fails
      }
    }
  }

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
          select: {
            id: true,
            upfrontType: true,
            upfrontValue: true,
            installmentType: true,
            installmentCount: true,
            installmentFrequency: true,
            milestoneIds: true,
            balancePaymentType: true,
            balanceDueDate: true,
            installmentMaturityDates: true,
            recurringEnabled: true,
            recurringFrequency: true,
            recurringCustomMonths: true,
            recurringStartDate: true,
          },
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
      proposalId: id,
      storedToken: storedToken,
      receivedToken: receivedToken,
      tokensMatch: storedToken === receivedToken,
      tokenLength: receivedToken.length,
      proposalTokenLength: storedToken.length,
      rawTokenFromUrl: rawToken,
      storedTokenType: typeof storedToken,
      receivedTokenType: typeof receivedToken,
      storedTokenFirstChars: storedToken.substring(0, 10),
      receivedTokenFirstChars: receivedToken.substring(0, 10),
    })
    
    if (!storedToken || storedToken !== receivedToken) {
      // Log detailed error for debugging
      console.error("Token validation failed:", {
        proposalId: id,
        hasStoredToken: !!storedToken,
        storedTokenLength: storedToken.length,
        receivedTokenLength: receivedToken.length,
        tokensMatch: storedToken === receivedToken,
        storedTokenPreview: storedToken.substring(0, 20),
        receivedTokenPreview: receivedToken.substring(0, 20),
      })
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Invalid Token</h1>
            <p className="text-gray-600">This approval token is invalid. Please use the link provided in your email.</p>
            <p className="text-xs text-gray-500 mt-2">
              Token mismatch. If this persists, please request a new approval link.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-4 p-3 bg-gray-100 rounded text-left text-xs font-mono">
                <p><strong>Debug Info:</strong></p>
                <p>Stored token exists: {storedToken ? 'Yes' : 'No'}</p>
                <p>Received token length: {receivedToken.length}</p>
                <p>Stored token length: {storedToken.length}</p>
              </div>
            )}
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
          paymentTerms: proposal.paymentTerms || [],
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
