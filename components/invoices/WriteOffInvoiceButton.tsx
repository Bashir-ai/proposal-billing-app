"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation"
import { X, FileX } from "lucide-react"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"

interface WriteOffInvoiceButtonProps {
  billId: string
  amount: number
  currency?: string
  disabled?: boolean
}

export function WriteOffInvoiceButton({ 
  billId, 
  amount, 
  currency = "EUR",
  disabled = false 
}: WriteOffInvoiceButtonProps) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleWriteOff = async () => {
    setLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/bills/${billId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "writeOff",
          notes: notes || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to write off invoice")
      }

      toast.success("Invoice written off successfully")
      router.refresh()
      setShowConfirm(false)
      setNotes("")
    } catch (err: any) {
      setError(err.message || "An error occurred while writing off the invoice")
      toast.error(err.message || "Failed to write off invoice")
    } finally {
      setLoading(false)
    }
  }

  if (showConfirm) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-orange-900">Write Off Invoice</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowConfirm(false)
                setError("")
                setNotes("")
              }}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription className="text-orange-700">
            This will mark the invoice as written off. The original amount ({formatCurrency(amount, currency)}) will be preserved for reporting purposes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Reason (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Why is this invoice being written off?"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-100 border border-red-300 rounded text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="flex space-x-2">
              <Button
                onClick={handleWriteOff}
                disabled={loading}
                variant="destructive"
              >
                {loading ? "Writing Off..." : "Confirm Write-Off"}
              </Button>
              <Button
                onClick={() => {
                  setShowConfirm(false)
                  setError("")
                  setNotes("")
                }}
                variant="outline"
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Button
      onClick={() => setShowConfirm(true)}
      variant="outline"
      size="sm"
      disabled={disabled}
      className="border-orange-300 text-orange-700 hover:bg-orange-50"
    >
      <FileX className="h-4 w-4 mr-2" />
      Write Off
    </Button>
  )
}
