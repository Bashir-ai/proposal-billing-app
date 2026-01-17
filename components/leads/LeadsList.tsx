"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash2 } from "lucide-react"
import { BulkDeleteDialog } from "@/components/clients/BulkDeleteDialog"

interface Lead {
  id: string
  name: string
  email?: string | null
  company?: string | null
  status: string
  areaOfLaw?: {
    id: string
    name: string
  } | null
  sectorOfActivity?: {
    id: string
    name: string
  } | null
  _count: {
    interactions: number
    todos: number
    proposals: number
  }
}

interface LeadsListProps {
  leads: Lead[]
  isAdmin: boolean
}

export function LeadsList({ leads, isAdmin }: LeadsListProps) {
  const router = useRouter()
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [validationData, setValidationData] = useState<{
    deletable: Array<{ id: string; name: string }>
    nonDeletable: Array<{ id: string; name: string; reason: string }>
  } | null>(null)

  const handleToggle = (leadId: string) => {
    const newSelected = new Set(selectedLeads)
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId)
    } else {
      newSelected.add(leadId)
    }
    setSelectedLeads(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set())
    } else {
      setSelectedLeads(new Set(leads.map((l) => l.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedLeads.size === 0) return

    setIsDeleting(true)
    try {
      const leadIds = Array.from(selectedLeads)
      
      const response = await fetch("/api/leads/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadIds,
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
      console.error("Error validating leads:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to validate leads. Please try again."
      alert(errorMessage)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleConfirmDelete = async (selectedIds: string[]) => {
    setIsDeleting(true)
    try {
      const response = await fetch("/api/leads/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadIds: selectedIds,
          action: "delete",
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || "Failed to delete leads")
      }

      const result = await response.json()
      
      setSelectedLeads(new Set())
      setShowDeleteConfirm(false)
      setValidationData(null)
      router.refresh()
      
      alert(result.message || `Successfully deleted ${selectedIds.length} lead(s)`)
    } catch (error) {
      console.error("Error deleting leads:", error)
      alert(error instanceof Error ? error.message : "Failed to delete leads. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  const hasSelection = selectedLeads.size > 0

  return (
    <>
      {isAdmin && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedLeads.size === leads.length && leads.length > 0}
              onCheckedChange={handleSelectAll}
              disabled={leads.length === 0}
            />
            <span className="text-sm text-gray-600">
              Select all ({leads.length} leads)
            </span>
          </div>
          {hasSelection && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {selectedLeads.size} selected
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

      <Card>
        <CardContent className="p-0">
          {leads.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No leads found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    {isAdmin && (
                      <th className="text-left p-2 w-12">
                        <Checkbox
                          checked={selectedLeads.size === leads.length && leads.length > 0}
                          onCheckedChange={handleSelectAll}
                          disabled={leads.length === 0}
                        />
                      </th>
                    )}
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Company</th>
                    <th className="text-left p-2">Email</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Area of Law</th>
                    <th className="text-left p-2">Sector</th>
                    <th className="text-left p-2">Interactions</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b hover:bg-gray-50">
                      {isAdmin && (
                        <td className="p-2">
                          <Checkbox
                            checked={selectedLeads.has(lead.id)}
                            onCheckedChange={() => handleToggle(lead.id)}
                          />
                        </td>
                      )}
                      <td className="p-2">
                        <Link
                          href={`/dashboard/leads/${lead.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {lead.name}
                        </Link>
                      </td>
                      <td className="p-2">{lead.company || "-"}</td>
                      <td className="p-2">{lead.email || "-"}</td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            lead.status === "CONVERTED"
                              ? "bg-green-100 text-green-800"
                              : lead.status === "LOST"
                              ? "bg-red-100 text-red-800"
                              : lead.status === "NEW"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {lead.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-2">{lead.areaOfLaw?.name || "-"}</td>
                      <td className="p-2">{lead.sectorOfActivity?.name || "-"}</td>
                      <td className="p-2">{lead._count.interactions}</td>
                      <td className="p-2">
                        <Link href={`/dashboard/leads/${lead.id}`}>
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
