"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

interface CloneProposalDialogProps {
  proposalId: string
  onClose: () => void
}

export function CloneProposalDialog({ proposalId, onClose }: CloneProposalDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [options, setOptions] = useState({
    copyClient: true,
    copyBillingMethod: true,
    copyLineItems: true,
    copyMilestones: true,
    copyPaymentTerms: true,
    copyTags: true,
    copyDescription: true,
  })

  const handleClone = async () => {
    setError("")
    setLoading(true)

    try {
      const response = await fetch(`/api/proposals/${proposalId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Failed to clone proposal")
        return
      }

      const clonedProposal = await response.json()
      router.push(`/dashboard/proposals/${clonedProposal.id}/edit`)
    } catch (error) {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Clone Proposal</CardTitle>
          <CardDescription>
            Select what you want to copy from this proposal to the new one
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.copyClient}
                onChange={(e) => setOptions({ ...options, copyClient: e.target.checked })}
                className="rounded"
              />
              <span>Client information</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.copyBillingMethod}
                onChange={(e) => setOptions({ ...options, copyBillingMethod: e.target.checked })}
                className="rounded"
              />
              <span>Billing method and configuration</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.copyLineItems}
                onChange={(e) => setOptions({ ...options, copyLineItems: e.target.checked })}
                className="rounded"
              />
              <span>Line items</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.copyMilestones}
                onChange={(e) => setOptions({ ...options, copyMilestones: e.target.checked })}
                className="rounded"
              />
              <span>Milestones</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.copyPaymentTerms}
                onChange={(e) => setOptions({ ...options, copyPaymentTerms: e.target.checked })}
                className="rounded"
              />
              <span>Payment terms</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.copyTags}
                onChange={(e) => setOptions({ ...options, copyTags: e.target.checked })}
                className="rounded"
              />
              <span>Tags</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.copyDescription}
                onChange={(e) => setOptions({ ...options, copyDescription: e.target.checked })}
                className="rounded"
              />
              <span>Description</span>
            </label>
          </div>

          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}

          <div className="flex space-x-2 pt-4">
            <Button
              onClick={handleClone}
              disabled={loading}
              className="flex-1"
            >
              {loading ? "Cloning..." : "Clone Proposal"}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


