"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { CloneProposalDialog } from "./CloneProposalDialog"
import { ClientApprovalStatus } from "@prisma/client"

interface ProposalActionsProps {
  proposalId: string
  canEdit: boolean
  canSubmit: boolean
  isClient: boolean
  clientApprovalStatus: ClientApprovalStatus
  hasProject: boolean
  canDelete: boolean
}

export function ProposalActions({
  proposalId,
  canEdit,
  canSubmit,
  isClient,
  clientApprovalStatus,
  hasProject,
  canDelete,
}: ProposalActionsProps) {
  const router = useRouter()
  const [showCloneDialog, setShowCloneDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleClientApproval = async (action: "approve" | "reject") => {
    if (action === "reject" && !rejectionReason.trim()) {
      setError("Please provide a reason for rejection")
      return
    }

    setError("")
    setLoading(true)

    try {
      const response = await fetch(`/api/proposals/${proposalId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: action === "reject" ? rejectionReason : undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Failed to update approval status")
      } else {
        router.refresh()
        setShowRejectDialog(false)
        setRejectionReason("")
      }
    } catch (error) {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
        </div>
      )}
      <div className="flex space-x-2">
        {canEdit && (
          <Link href={`/dashboard/proposals/${proposalId}/edit`}>
            <Button variant="outline">Edit</Button>
          </Link>
        )}
        {canSubmit && (
          <form action={`/api/proposals/${proposalId}`} method="POST">
            <input type="hidden" name="action" value="submit" />
            <Button type="submit">Submit for Approval</Button>
          </form>
        )}
        {!isClient && (
          <Button
            variant="outline"
            onClick={() => setShowCloneDialog(true)}
          >
            Clone Proposal
          </Button>
        )}
        {isClient && clientApprovalStatus === "PENDING" && (
          <>
            <Button
              onClick={() => handleClientApproval("approve")}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              Approve Proposal
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(true)}
              disabled={loading}
              className="border-red-600 text-red-600 hover:bg-red-50"
            >
              Reject Proposal
            </Button>
          </>
        )}
        {!isClient && !hasProject && clientApprovalStatus === "APPROVED" && (
          <Link href={`/dashboard/projects/new?proposalId=${proposalId}`}>
            <Button variant="outline">Convert to Project</Button>
          </Link>
        )}
        {canDelete && (
          <Button
            variant="outline"
            onClick={async () => {
              if (confirm("Are you sure you want to delete this proposal? This action cannot be undone.")) {
                setLoading(true)
                setError("")
                try {
                  const response = await fetch(`/api/proposals/${proposalId}`, {
                    method: "DELETE",
                  })
                  
                  if (!response.ok) {
                    // Check if response is JSON before trying to parse
                    const contentType = response.headers.get("content-type")
                    let errorMessage = "Failed to delete proposal"
                    
                    if (contentType && contentType.includes("application/json")) {
                      try {
                        const data = await response.json()
                        errorMessage = data.error || data.message || errorMessage
                      } catch (e) {
                        errorMessage = response.statusText || errorMessage
                      }
                    } else {
                      errorMessage = `${response.status}: ${response.statusText || errorMessage}`
                    }
                    
                    setError(errorMessage)
                    return
                  }
                  
                  // Redirect to proposals list after successful deletion
                  router.push("/dashboard/proposals")
                } catch (error: any) {
                  const errorMessage = error?.message || "An error occurred. Please try again."
                  setError(errorMessage)
                  console.error("Delete proposal error:", error)
                } finally {
                  setLoading(false)
                }
              }
            }}
            disabled={loading}
            className="border-red-600 text-red-600 hover:bg-red-50"
          >
            {loading ? "Deleting..." : "Delete Proposal"}
          </Button>
        )}
      </div>

      {showCloneDialog && (
        <CloneProposalDialog
          proposalId={proposalId}
          onClose={() => setShowCloneDialog(false)}
        />
      )}

      {showRejectDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Reject Proposal</CardTitle>
              <CardDescription>
                Please provide a reason for rejecting this proposal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rejectionReason">Reason *</Label>
                <Textarea
                  id="rejectionReason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  placeholder="Please explain why you are rejecting this proposal..."
                  required
                />
              </div>
              {error && (
                <div className="text-sm text-destructive">{error}</div>
              )}
              <div className="flex space-x-2">
                <Button
                  onClick={() => handleClientApproval("reject")}
                  disabled={loading || !rejectionReason.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {loading ? "Submitting..." : "Reject Proposal"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRejectDialog(false)
                    setRejectionReason("")
                    setError("")
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}

