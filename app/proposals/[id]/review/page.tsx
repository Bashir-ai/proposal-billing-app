import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'

// This page redirects old query-parameter-based links to the new path-based route
// This ensures backward compatibility with old email links
export default async function ProposalReviewPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { id } = await params
  const { token: rawToken } = await searchParams
  
  // If token is provided as query parameter, redirect to path-based route
  // Hex tokens are URL-safe, so no encoding needed
  if (rawToken) {
    const trimmedToken = rawToken.trim()
    redirect(`/proposals/${id}/review/${trimmedToken}`)
  }

  // No token provided - show error
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Invalid Link</h1>
        <p className="text-gray-600">This proposal review link is invalid. Please use the link provided in your email.</p>
      </div>
    </div>
  )
}
