"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface ClientApprovalActionProps {
  proposalId: string
  token: string
  action?: string
}

export function ClientApprovalAction({ proposalId, token, action: initialAction }: ClientApprovalActionProps) {
  const router = useRouter()
  const [action, setAction] = useState<"approve" | "reject" | null>(initialAction === "approve" ? "approve" : initialAction === "reject" ? "reject" : null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (initialAction === "approve" || initialAction === "reject") {
      setAction(initialAction)
    }
  }, [initialAction])

  const handleSubmit = async () => {
    if (!action) {
      setError("Please select approve or reject")
      return
    }

    if (action === "reject" && !rejectionReason.trim()) {
      setError("Please provide a reason for rejection")
      return
    }

    setError(null)
    setLoading(true)

    try {
      const response = await fetch(`/api/proposals/${proposalId}/client-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          action,
          ...(action === "reject" && { reason: rejectionReason }),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to process approval")
      }

      setSuccess(true)
      // Redirect after 3 seconds
      setTimeout(() => {
        router.push("/")
      }, 3000)
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className={`p-6 rounded-lg ${action === "approve" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
          <h3 className={`text-xl font-semibold ${action === "approve" ? "text-green-800" : "text-red-800"}`}>
            Proposal {action === "approve" ? "Approved" : "Rejected"} Successfully
          </h3>
          <p className={`mt-2 ${action === "approve" ? "text-green-700" : "text-red-700"}`}>
            Thank you for your response. You will be redirected shortly.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {!action && (
        <div className="flex space-x-4">
          <Button
            onClick={() => setAction("approve")}
            className="flex-1 bg-green-600 hover:bg-green-700 text-lg py-6"
            size="lg"
          >
            Approve Proposal
          </Button>
          <Button
            onClick={() => setAction("reject")}
            variant="destructive"
            className="flex-1 text-lg py-6"
            size="lg"
          >
            Reject Proposal
          </Button>
        </div>
      )}

      {action && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="font-semibold text-blue-800">
              You are about to {action === "approve" ? "approve" : "reject"} this proposal
            </p>
          </div>

          {action === "reject" && (
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">Reason for Rejection *</Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                placeholder="Please explain why you are rejecting this proposal..."
                required
              />
            </div>
          )}

          <div className="flex space-x-3">
            <Button
              onClick={handleSubmit}
              disabled={loading || (action === "reject" && !rejectionReason.trim())}
              className={action === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
              variant={action === "reject" ? "destructive" : "default"}
              size="lg"
            >
              {loading ? "Processing..." : `Confirm ${action === "approve" ? "Approval" : "Rejection"}`}
            </Button>
            <Button
              onClick={() => {
                setAction(null)
                setRejectionReason("")
                setError(null)
              }}
              variant="outline"
              disabled={loading}
              size="lg"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}



