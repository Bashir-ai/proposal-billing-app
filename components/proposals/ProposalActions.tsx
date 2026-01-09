"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { CloneProposalDialog } from "./CloneProposalDialog"
import { SubmitProposalModal } from "./SubmitProposalModal"
import { ResubmitModal } from "@/components/approvals/ResubmitModal"
import { ApprovalButton } from "@/components/shared/ApprovalButton"
import { DownloadPdfButton } from "./DownloadPdfButton"
import { DeleteButton } from "@/components/shared/DeleteButton"

interface ProposalActionsProps {
  proposalId: string
  proposalTitle?: string
  canEdit: boolean
  canSubmit: boolean
  isClient: boolean
  clientApprovalStatus: "PENDING" | "APPROVED" | "REJECTED"
  hasProject: boolean
  canDelete: boolean
  canApprove?: boolean
  canResubmit?: boolean
  userApproval?: { id: string; status: string } | null
  proposalStatus?: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED"
  currentUserRole?: string
  canStillApprove?: boolean
}

export function ProposalActions({
  proposalId,
  proposalTitle,
  canEdit,
  canSubmit,
  isClient,
  clientApprovalStatus,
  hasProject,
  canDelete,
  canApprove = false,
  canResubmit = false,
  userApproval = null,
  proposalStatus,
  currentUserRole,
  canStillApprove = true,
}: ProposalActionsProps) {
  const router = useRouter()
  const [showCloneDialog, setShowCloneDialog] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showResubmitModal, setShowResubmitModal] = useState(false)
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
        {/* PDF Download Button - Available for all non-client users */}
        {!isClient && (
          <DownloadPdfButton proposalId={proposalId} />
        )}
        {canSubmit && (
          <Button onClick={() => setShowSubmitModal(true)}>
            Submit for Approval
          </Button>
        )}
        {/* Approval Button - Show when proposal is submitted and user can approve */}
        {canApprove && 
         canStillApprove && 
         proposalStatus === "SUBMITTED" && (
          <ApprovalButton
            proposalId={proposalId}
            currentUserRole={(currentUserRole as any) || (isClient ? "CLIENT" : "STAFF")}
          />
        )}
        {canResubmit && (
          <Button
            variant="outline"
            onClick={() => setShowResubmitModal(true)}
          >
            Resubmit for Approval
          </Button>
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
          <Button 
            variant="outline"
            onClick={() => {
              router.push(`/projects/new?proposalId=${proposalId}`)
            }}
          >
            Convert to Project
          </Button>
        )}
        {canDelete && (
          <DeleteButton
            itemId={proposalId}
            itemType="proposal"
            itemName={proposalTitle}
          />
        )}
      </div>

      {showCloneDialog && (
        <CloneProposalDialog
          proposalId={proposalId}
          onClose={() => setShowCloneDialog(false)}
        />
      )}

      {showSubmitModal && (
        <SubmitProposalModal
          proposalId={proposalId}
          isOpen={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          onSuccess={() => {
            router.refresh()
          }}
        />
      )}

      {showResubmitModal && (
        <ResubmitModal
          itemId={proposalId}
          itemType="proposal"
          isOpen={showResubmitModal}
          onClose={() => setShowResubmitModal(false)}
          onSuccess={() => {
            router.refresh()
          }}
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

