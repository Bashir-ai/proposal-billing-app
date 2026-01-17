"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash2 } from "lucide-react"
import { BulkDeleteDialog } from "@/components/clients/BulkDeleteDialog"
import { ProposalStatus, ProposalType, ClientApprovalStatus } from "@prisma/client"
import { formatCurrency, formatDate } from "@/lib/utils"

interface Proposal {
  id: string
  title: string
  description?: string | null
  status: ProposalStatus
  type: ProposalType
  clientApprovalStatus: ClientApprovalStatus
  amount?: number | null
  proposalNumber?: string | null
  createdAt: Date
  deletedAt?: Date | null
  client: {
    id: string
    name: string
    company?: string | null
  } | null
  lead?: {
    id: string
    name: string
    email?: string | null
    company?: string | null
    status?: string | null
  } | null
  creator: {
    name: string
  }
  tags: Array<{ id: string; name: string; color?: string | null }>
  customTags: string[]
}

interface ProposalsListProps {
  proposals: Proposal[]
  isAdmin: boolean
}

export function ProposalsList({ proposals, isAdmin }: ProposalsListProps) {
  const router = useRouter()
  const [selectedProposals, setSelectedProposals] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [validationData, setValidationData] = useState<{
    deletable: Array<{ id: string; name: string }>
    nonDeletable: Array<{ id: string; name: string; reason: string }>
  } | null>(null)

  const handleToggle = (proposalId: string) => {
    const newSelected = new Set(selectedProposals)
    if (newSelected.has(proposalId)) {
      newSelected.delete(proposalId)
    } else {
      newSelected.add(proposalId)
    }
    setSelectedProposals(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedProposals.size === proposals.length) {
      setSelectedProposals(new Set())
    } else {
      setSelectedProposals(new Set(proposals.map((p) => p.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedProposals.size === 0) return

    setIsDeleting(true)
    try {
      const proposalIds = Array.from(selectedProposals)
      
      const response = await fetch("/api/proposals/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          proposalIds,
          action: "validate",
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        const errorMessage = errorData.error || errorData.message || `Server returned ${response.status}`
        throw new Error(errorMessage)
      }

      const data = await response.json()
      setValidationData(data)
      setShowDeleteConfirm(true)
    } catch (error) {
      console.error("Error validating proposals:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to validate proposals. Please try again."
      alert(errorMessage)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleConfirmDelete = async (selectedIds: string[]) => {
    setIsDeleting(true)
    try {
      const response = await fetch("/api/proposals/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          proposalIds: selectedIds,
          action: "delete",
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || "Failed to delete proposals")
      }

      const result = await response.json()
      
      setSelectedProposals(new Set())
      setShowDeleteConfirm(false)
      setValidationData(null)
      router.refresh()
      
      alert(result.message || `Successfully deleted ${selectedIds.length} proposal(s)`)
    } catch (error) {
      console.error("Error deleting proposals:", error)
      alert(error instanceof Error ? error.message : "Failed to delete proposals. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  const hasSelection = selectedProposals.size > 0

  const getStatusColor = (status: ProposalStatus) => {
    switch (status) {
      case "DRAFT":
        return "bg-gray-100 text-gray-800"
      case "SUBMITTED":
        return "bg-blue-100 text-blue-800"
      case "APPROVED":
        return "bg-green-100 text-green-800"
      case "REJECTED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <>
      {isAdmin && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedProposals.size === proposals.length && proposals.length > 0}
              onCheckedChange={handleSelectAll}
              disabled={proposals.length === 0}
            />
            <span className="text-sm text-gray-600">
              Select all ({proposals.length} proposals)
            </span>
          </div>
          {hasSelection && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {selectedProposals.size} selected
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        {proposals.map((proposal) => (
          <div key={proposal.id} className="relative">
            {isAdmin && (
              <div
                className="absolute top-2 right-2 z-50 bg-white rounded border shadow-sm p-1"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
              >
                <Checkbox
                  checked={selectedProposals.has(proposal.id)}
                  onCheckedChange={() => handleToggle(proposal.id)}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                />
              </div>
            )}
            <Link href={`/dashboard/proposals/${proposal.id}`}>
              <Card
                className={`hover:shadow-lg transition-shadow ${
                  selectedProposals.has(proposal.id) ? "ring-2 ring-primary" : ""
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold">{proposal.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(proposal.status)}`}>
                          {proposal.status}
                        </span>
                      </div>
                      {proposal.proposalNumber && (
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          #{proposal.proposalNumber}
                        </p>
                      )}
                      <p className="text-sm text-gray-600 mb-2">
                        {proposal.client ? `Client: ${proposal.client.name}` : proposal.lead ? `Lead: ${proposal.lead.name}` : "No client/lead"}
                        {proposal.amount && ` • ${formatCurrency(proposal.amount)}`}
                      </p>
                      {proposal.description && (
                        <p className="text-sm text-gray-500 line-clamp-2 mb-2">{proposal.description}</p>
                      )}
                      <p className="text-xs text-gray-400">
                        Created: {formatDate(proposal.createdAt)} by {proposal.creator.name}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        ))}
      </div>

      {validationData && (
        <BulkDeleteDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          deletable={validationData.deletable}
          nonDeletable={validationData.nonDeletable}
          onConfirm={handleConfirmDelete}
          isDeleting={isDeleting}
        />
      )}
    </>
  )
}
