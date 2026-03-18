"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ApproveOnBehalfButtonProps {
  proposalId: string
}

export function ApproveOnBehalfButton({ proposalId }: ApproveOnBehalfButtonProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [action, setAction] = useState<"approve" | "reject" | null>(null)
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (action === "reject" && !reason.trim()) {
      setError("Please provide a reason for rejection")
      return
    }

    setError(null)
    setLoading(true)

    try {
      const response = await fetch(`/api/proposals/${proposalId}/approve-on-behalf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: action === "reject" ? reason : undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update approval status")
      }

      // Trigger notification refresh
      window.dispatchEvent(new Event("notifications:refresh"))
      
      router.refresh()
      setShowForm(false)
      setReason("")
      setAction(null)
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (!showForm) {
    return (
      <div className="flex space-x-2">
        <Button
          onClick={() => {
            setShowForm(true)
            setAction("approve")
          }}
          className="bg-green-600 hover:bg-green-700"
        >
          Approve on Behalf of Client
        </Button>
        <Button
          onClick={() => {
            setShowForm(true)
            setAction("reject")
          }}
          variant="destructive"
        >
          Reject on Behalf of Client
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {action === "reject" && (
        <div className="space-y-2">
          <Label htmlFor="reason">Reason for Rejection *</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Please explain why you are rejecting this proposal on behalf of the client..."
            required
          />
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}
      <div className="flex space-x-2">
        <Button
          onClick={handleSubmit}
          disabled={loading || (action === "reject" && !reason.trim())}
          className={action === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
          variant={action === "reject" ? "destructive" : "default"}
        >
          {loading ? "Submitting..." : action === "approve" ? "Confirm Approval" : "Confirm Rejection"}
        </Button>
        <Button
          onClick={() => {
            setShowForm(false)
            setReason("")
            setAction(null)
            setError(null)
          }}
          variant="outline"
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

