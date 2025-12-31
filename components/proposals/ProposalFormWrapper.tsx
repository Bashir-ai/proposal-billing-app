"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ProposalForm } from "./ProposalForm"

interface ProposalFormWrapperProps {
  clients: Array<{ id: string; name: string; company?: string | null; defaultDiscountPercent?: number | null; defaultDiscountAmount?: number | null }>
  users?: Array<{ id: string; name: string; email: string; defaultHourlyRate?: number | null }>
  initialData?: any
  proposalId?: string
}

export function ProposalFormWrapper({ clients, users = [], initialData, proposalId }: ProposalFormWrapperProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (data: any) => {
    setError(null)
    setLoading(true)
    try {
      const url = proposalId ? `/api/proposals/${proposalId}` : "/api/proposals"
      const method = proposalId ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        // Check if response is JSON before trying to parse
        const contentType = response.headers.get("content-type")
        let errorMessage = `Failed to ${proposalId ? "update" : "create"} proposal`
        let errorDetails: any = null
        
        if (contentType && contentType.includes("application/json")) {
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorData.message || errorMessage
            errorDetails = errorData
            
            // If there are validation details, include them in the error message
            if (errorData.details && Array.isArray(errorData.details)) {
              const validationErrors = errorData.details
                .map((err: any) => `${err.path.join(".")}: ${err.message}`)
                .join(", ")
              errorMessage = `${errorMessage}: ${validationErrors}`
            }
            
            // Log full error details to console for debugging
            console.error("API Error Response:", errorData)
          } catch (e) {
            // If JSON parsing fails, use status text
            console.error("Failed to parse error response as JSON:", e)
            errorMessage = response.statusText || errorMessage
          }
        } else {
          // If response is HTML (error page), try to get status text
          const text = await response.text()
          console.error("Non-JSON error response:", text.substring(0, 500))
          errorMessage = `${response.status}: ${response.statusText || errorMessage}`
        }
        
        console.error("Full error details:", {
          status: response.status,
          statusText: response.statusText,
          errorMessage,
          errorDetails
        })
        
        setError(errorMessage)
        setLoading(false)
        throw new Error(errorMessage)
      }

      // Check content type before parsing JSON
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const errorMessage = "Server returned an invalid response. Please try again."
        setError(errorMessage)
        setLoading(false)
        throw new Error(errorMessage)
      }

      const proposal = await response.json()
      setLoading(false)
      router.push(`/dashboard/proposals/${proposal.id || proposalId}`)
    } catch (error: any) {
      // Error state is already set above
      setLoading(false)
      console.error("Proposal submission error:", error)
      // Re-throw to let ProposalForm handle it
      throw error
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
        </div>
      )}
      <ProposalForm clients={clients} users={users} onSubmit={handleSubmit} initialData={initialData} loading={loading} />
    </div>
  )
}



