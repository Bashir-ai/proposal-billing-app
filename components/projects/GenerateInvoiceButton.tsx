"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { FileText } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

interface GenerateInvoiceButtonProps {
  projectId: string
  unbilledTimesheetAmount: number
  unbilledChargesAmount: number
  currency?: string
}

export function GenerateInvoiceButton({
  projectId,
  unbilledTimesheetAmount,
  unbilledChargesAmount,
  currency = "EUR",
}: GenerateInvoiceButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalAmount = unbilledTimesheetAmount + unbilledChargesAmount
  const hasUnbilledItems = totalAmount > 0

  const handleGenerateInvoice = async () => {
    if (!hasUnbilledItems) {
      setError("No unbilled items to invoice")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/generate-invoice`, {
        method: "POST",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to generate invoice")
      }

      const result = await response.json()
      
      // Redirect to the invoice detail page
      router.push(`/dashboard/bills/${result.invoice.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.")
      setLoading(false)
    }
  }

  if (!hasUnbilledItems) {
    return null
  }

  return (
    <Card className="mb-8 border-green-300 bg-green-50">
      <CardHeader>
        <CardTitle>Generate Invoice</CardTitle>
        <CardDescription>
          Create an invoice from all unbilled timesheet entries and charges
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Unbilled Timesheet Entries:</span>
              <span className="font-semibold">{formatCurrency(unbilledTimesheetAmount, currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Unbilled Charges:</span>
              <span className="font-semibold">{formatCurrency(unbilledChargesAmount, currency)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold border-t pt-2">
              <span>Total Invoice Amount:</span>
              <span>{formatCurrency(totalAmount, currency)}</span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <Button
            onClick={handleGenerateInvoice}
            disabled={loading || !hasUnbilledItems}
            className="w-full"
          >
            <FileText className="h-4 w-4 mr-2" />
            {loading ? "Generating Invoice..." : "Generate Invoice"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}



