"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { X } from "lucide-react"
import { useRouter } from "next/navigation"

interface User {
  id: string
  name: string
  email: string
  role: string
}

interface SubmitInvoiceModalProps {
  invoiceId: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function SubmitInvoiceModal({
  invoiceId,
  isOpen,
  onClose,
  onSuccess,
}: SubmitInvoiceModalProps) {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [selectedApproverIds, setSelectedApproverIds] = useState<string[]>([])
  const [approvalRequirement, setApprovalRequirement] = useState<"ALL" | "ANY" | "MAJORITY">("ALL")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch available users (excluding clients)
  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      fetch("/api/users")
        .then((res) => res.json())
        .then((data) => {
          // Filter out clients
          const staffUsers = data.filter((user: User) => user.role !== "CLIENT")
          setUsers(staffUsers)
        })
        .catch((err) => {
          console.error("Failed to fetch users:", err)
          setError("Failed to load team members")
        })
        .finally(() => setLoading(false))
    }
  }, [isOpen])

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/bills/${invoiceId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approverIds: selectedApproverIds.length > 0 ? selectedApproverIds : undefined,
          approvalRequirement: selectedApproverIds.length > 0 ? approvalRequirement : undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to submit invoice")
      }

      // Trigger notification refresh
      window.dispatchEvent(new Event("notifications:refresh"))
      
      onSuccess?.()
      onClose()
      router.refresh()
    } catch (err: any) {
      setError(err.message || "Failed to submit invoice")
    } finally {
      setSubmitting(false)
    }
  }

  const toggleApprover = (userId: string) => {
    setSelectedApproverIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Submit Invoice for Approval</CardTitle>
              <CardDescription>
                Select team members who need to approve this invoice
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Approval Requirement Selection - Only show when approvers are selected */}
          {selectedApproverIds.length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Approval Requirement</Label>
              <p className="text-sm text-gray-600">
                Choose how many of the selected approvers must approve:
              </p>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer p-3 border rounded hover:bg-gray-50">
                  <input
                    type="radio"
                    name="approvalRequirement"
                    value="ALL"
                    checked={approvalRequirement === "ALL"}
                    onChange={(e) => setApprovalRequirement(e.target.value as "ALL")}
                    className="rounded"
                  />
                  <div>
                    <span className="font-medium">All selected must approve</span>
                    <p className="text-xs text-gray-500">
                      Every selected team member must approve
                    </p>
                  </div>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer p-3 border rounded hover:bg-gray-50">
                  <input
                    type="radio"
                    name="approvalRequirement"
                    value="ANY"
                    checked={approvalRequirement === "ANY"}
                    onChange={(e) => setApprovalRequirement(e.target.value as "ANY")}
                    className="rounded"
                  />
                  <div>
                    <span className="font-medium">Any one approval sufficient</span>
                    <p className="text-xs text-gray-500">
                      Only one selected team member needs to approve
                    </p>
                  </div>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer p-3 border rounded hover:bg-gray-50">
                  <input
                    type="radio"
                    name="approvalRequirement"
                    value="MAJORITY"
                    checked={approvalRequirement === "MAJORITY"}
                    onChange={(e) => setApprovalRequirement(e.target.value as "MAJORITY")}
                    className="rounded"
                  />
                  <div>
                    <span className="font-medium">Majority must approve</span>
                    <p className="text-xs text-gray-500">
                      More than half of selected team members must approve
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Team Member Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Select Team Members to Approve</Label>
            <p className="text-sm text-gray-600">
              Choose which team members should review and approve this invoice
            </p>
            {loading ? (
              <p className="text-sm text-gray-500">Loading team members...</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-gray-500">No team members available</p>
            ) : (
              <div className="border rounded p-4 max-h-64 overflow-y-auto space-y-2">
                {users.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-50 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedApproverIds.includes(user.id)}
                      onChange={() => toggleApprover(user.id)}
                      className="rounded"
                    />
                    <div className="flex-1">
                      <span className="font-medium">{user.name}</span>
                      <span className="text-sm text-gray-500 ml-2">({user.email})</span>
                      <span className="text-xs text-gray-400 ml-2 capitalize">• {user.role.toLowerCase()}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
            {selectedApproverIds.length > 0 && (
              <p className="text-sm text-gray-600">
                {selectedApproverIds.length} team member{selectedApproverIds.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          {/* Submit without internal approvals option */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-gray-700">
              <strong>Note:</strong> You can also submit without internal approvals by leaving the selection empty.
              The invoice will be marked as approved immediately.
            </p>
          </div>

          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || loading}>
              {submitting ? "Submitting..." : "Submit Invoice"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

