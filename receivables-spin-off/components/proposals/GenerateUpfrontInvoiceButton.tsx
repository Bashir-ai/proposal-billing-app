"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

interface GenerateUpfrontInvoiceButtonProps {
  proposalId: string
}

export function GenerateUpfrontInvoiceButton({ proposalId }: GenerateUpfrontInvoiceButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/proposals/${proposalId}/generate-upfront-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        const data = await response.json()
        
        // If it's a schema mismatch error, show detailed instructions
        if (data.error?.includes("DATABASE MIGRATION REQUIRED") || data.error?.includes("schema mismatch")) {
          const steps = data.steps || data.instructions || []
          const stepText = steps.map((s: any, i: number) => {
            if (typeof s === 'string') return `${i + 1}. ${s}`
            return `${s.step || i + 1}. ${s.action || s}: ${s.command || ''}`
          }).join('\n')
          
          throw new Error(
            `${data.error || data.message || "Database migration required"}\n\n` +
            `Please follow these steps:\n${stepText}\n\n` +
            (data.alternative ? `Alternative: ${data.alternative}` : '')
          )
        }
        
        throw new Error(data.error || "Failed to generate upfront payment invoice")
      }

      const result = await response.json()
      router.push(`/dashboard/bills/${result.invoice.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "An error occurred while generating the invoice.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
          <div className="text-red-800 font-semibold mb-2">⚠️ Action Required</div>
          <div className="text-red-700 text-sm whitespace-pre-line font-mono">
            {error}
          </div>
          <div className="mt-3 pt-3 border-t border-red-200">
            <div className="text-red-600 text-xs font-semibold">Quick Fix:</div>
            <div className="text-red-700 text-xs mt-1 font-mono bg-red-100 p-2 rounded">
              1. Stop server (Ctrl+C)<br/>
              2. Run: npm run db:migrate-upfront<br/>
              3. Restart: npm run dev<br/>
              4. Try again
            </div>
          </div>
        </div>
      )}
      <Button
        onClick={handleGenerate}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          "Generate Upfront Payment Invoice"
        )}
      </Button>
    </div>
  )
}

