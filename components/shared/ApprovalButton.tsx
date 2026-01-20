"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { UserRole } from "@prisma/client"

interface ApprovalButtonProps {
  proposalId?: string
  billId?: string
  currentUserRole: UserRole
}

export function ApprovalButton({ proposalId, billId, currentUserRole }: ApprovalButtonProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [comments, setComments] = useState("")
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<"approve" | "reject" | null>(null)

  const handleSubmit = async (status: "APPROVED" | "REJECTED") => {
    setLoading(true)
    try {
      const response = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId,
          billId,
          status,
          comments,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to submit approval")
      }

      // Trigger notification refresh
      window.dispatchEvent(new Event("notifications:refresh"))
      
      router.refresh()
      setShowForm(false)
      setComments("")
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (!showForm) {
    return (
      <div className="flex space-x-2" role="group" aria-label="Approval actions">
        <Button
          onClick={() => {
            setShowForm(true)
            setAction("approve")
          }}
          className="bg-green-600 hover:bg-green-700"
          aria-label={`Approve this ${proposalId ? 'proposal' : 'invoice'}`}
        >
          Approve
        </Button>
        <Button
          onClick={() => {
            setShowForm(true)
            setAction("reject")
          }}
          variant="destructive"
          aria-label={`Reject this ${proposalId ? 'proposal' : 'invoice'}`}
        >
          Reject
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4" role="form" aria-label={`${action === "approve" ? "Approval" : "Rejection"} form`}>
      <div className="space-y-2">
        <Label htmlFor="comments">Comments</Label>
        <Textarea
          id="comments"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
          placeholder="Add your comments..."
          aria-describedby="comments-help"
        />
        <span id="comments-help" className="sr-only">Optional comments for your {action === "approve" ? "approval" : "rejection"}</span>
      </div>
      <div className="flex space-x-2">
        <Button
          onClick={() => handleSubmit(action === "approve" ? "APPROVED" : "REJECTED")}
          disabled={loading}
          className={action === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
          variant={action === "reject" ? "destructive" : "default"}
          aria-label={loading ? "Submitting..." : action === "approve" ? "Confirm approval" : "Confirm rejection"}
        >
          {loading ? "Submitting..." : action === "approve" ? "Confirm Approval" : "Confirm Rejection"}
        </Button>
        <Button
          onClick={() => {
            setShowForm(false)
            setComments("")
            setAction(null)
          }}
          variant="outline"
          disabled={loading}
          aria-label="Cancel and go back"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}




