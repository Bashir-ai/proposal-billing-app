"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { X, XCircle } from "lucide-react"
import { toast } from "sonner"

interface CancelInvoiceButtonProps {
  billId: string
  disabled?: boolean
}

export function CancelInvoiceButton({ 
  billId, 
  disabled = false 
}: CancelInvoiceButtonProps) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleCancel = async () => {
    setLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/bills/${billId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to cancel invoice")
      }

      toast.success("Invoice cancelled successfully")
      router.refresh()
      setShowConfirm(false)
    } catch (err: any) {
      setError(err.message || "An error occurred while cancelling the invoice")
      toast.error(err.message || "Failed to cancel invoice")
    } finally {
      setLoading(false)
    }
  }

  if (showConfirm) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-red-900">Cancel Invoice</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowConfirm(false)
                setError("")
              }}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription className="text-red-700">
            This will mark the invoice as cancelled. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-sm text-red-800">
              {error}
            </div>
          )}
          <div className="flex space-x-2">
            <Button
              onClick={handleCancel}
              disabled={loading}
              variant="destructive"
            >
              {loading ? "Cancelling..." : "Confirm Cancellation"}
            </Button>
            <Button
              onClick={() => {
                setShowConfirm(false)
                setError("")
              }}
              variant="outline"
              disabled={loading}
            >
              Cancel
            </Button>
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
      className="border-red-300 text-red-700 hover:bg-red-50"
    >
      <XCircle className="h-4 w-4 mr-2" />
      Cancel Invoice
    </Button>
  )
}
