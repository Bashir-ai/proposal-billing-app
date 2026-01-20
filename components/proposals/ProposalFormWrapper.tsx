"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ProposalForm } from "./ProposalForm"

interface ProposalFormWrapperProps {
  clients: Array<{ id: string; name: string; company?: string | null; defaultDiscountPercent?: number | null; defaultDiscountAmount?: number | null }>
  leads?: Array<{ id: string; name: string; company?: string | null }>
  users?: Array<{ id: string; name: string; email: string; defaultHourlyRate?: number | null }>
  initialData?: any
  proposalId?: string
}

export function ProposalFormWrapper({ clients: initialClients, leads: initialLeads = [], users = [], initialData, proposalId }: ProposalFormWrapperProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [leads, setLeads] = useState<Array<{ id: string; name: string; company?: string | null }>>(initialLeads)
  const [clients, setClients] = useState<Array<{ id: string; name: string; company?: string | null; defaultDiscountPercent?: number | null; defaultDiscountAmount?: number | null }>>(initialClients)

  // Refresh leads list (exclude converted, deleted, and archived leads)
  const refreshLeads = async () => {
    try {
      const response = await fetch("/api/leads")
      if (response.ok) {
        const data = await response.json()
        // Filter out converted, deleted, and archived leads (matching server-side filter)
        const filteredLeads = data.filter((lead: any) => 
          lead.status !== "CONVERTED" && 
          !lead.deletedAt && 
          !lead.archivedAt
        )
        setLeads(filteredLeads)
      }
    } catch (err) {
      console.error("Error refreshing leads:", err)
    }
  }

  // Refresh leads when component mounts or when a new lead is created
  useEffect(() => {
    refreshLeads()
  }, [])

  // Refresh clients list
  const refreshClients = async () => {
    try {
      const response = await fetch("/api/clients")
      if (response.ok) {
        const data = await response.json()
        // Filter out deleted and archived clients
        const filteredClients = data.filter((client: any) => 
          !client.deletedAt && !client.archivedAt
        )
        setClients(filteredClients)
      }
    } catch (err) {
      console.error("Error refreshing clients:", err)
    }
  }

  const handleLeadCreated = (newLead: { id: string; name: string; company?: string | null }) => {
    // Add the new lead to the list
    setLeads(prev => [...prev, newLead])
    // Also refresh from server to ensure we have the latest data
    refreshLeads()
  }

  const handleClientCreated = (newClient: { id: string; name: string; company?: string | null }) => {
    // Add the new client to the list
    setClients(prev => [...prev, newClient])
    // Also refresh from server to ensure we have the latest data
    refreshClients()
  }

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
      <ProposalForm 
        clients={clients} 
        leads={leads} 
        users={users} 
        onSubmit={handleSubmit} 
        initialData={initialData} 
        loading={loading}
        onLeadCreated={handleLeadCreated}
        onClientCreated={handleClientCreated}
      />
    </div>
  )
}



