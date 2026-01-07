"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Receipt } from "lucide-react"
import { useRouter } from "next/navigation"

interface GenerateFirstRecurringInvoiceButtonProps {
  proposalId: string
}

export function GenerateFirstRecurringInvoiceButton({ proposalId }: GenerateFirstRecurringInvoiceButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!confirm("Generate the first recurring invoice for this proposal? This will mark the start of the recurring billing cycle.")) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/proposals/${proposalId}/generate-first-recurring-invoice`, {
        method: "POST",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to generate invoice")
      }

      const result = await response.json()
      router.push(`/dashboard/bills/${result.invoice.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "An error occurred")
      console.error("Error generating first recurring invoice:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button
        onClick={handleGenerate}
        disabled={loading}
        variant="default"
        className="bg-blue-600 hover:bg-blue-700"
      >
        <Receipt className="h-4 w-4 mr-2" />
        {loading ? "Generating..." : "Generate First Recurring Invoice"}
      </Button>
      {error && (
        <p className="text-sm text-destructive mt-2">{error}</p>
      )}
    </div>
  )
}


