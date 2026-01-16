"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash2 } from "lucide-react"
import { BulkDeleteDialog } from "./BulkDeleteDialog"

interface Client {
  id: string
  name: string
  company: string | null
  email: string | null
  kycCompleted: boolean
  _count: {
    proposals: number
    bills: number
    projects: number
  }
}

interface ClientsListProps {
  clients: Client[]
  isAdmin: boolean
}

export function ClientsList({ clients, isAdmin }: ClientsListProps) {
  // Debug: Remove this after testing
  console.log("ClientsList - isAdmin:", isAdmin, "clients count:", clients.length)
  
  const router = useRouter()
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [validationData, setValidationData] = useState<{
    deletable: Array<{ id: string; name: string }>
    nonDeletable: Array<{ id: string; name: string; reason: string }>
  } | null>(null)

  const handleToggle = (clientId: string) => {
    const newSelected = new Set(selectedClients)
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId)
    } else {
      newSelected.add(clientId)
    }
    setSelectedClients(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedClients.size === clients.length) {
      setSelectedClients(new Set())
    } else {
      setSelectedClients(new Set(clients.map((c) => c.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedClients.size === 0) return

    setIsDeleting(true)
    try {
      // First, validate which clients can be deleted
      const response = await fetch("/api/clients/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientIds: Array.from(selectedClients),
          action: "validate",
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to validate clients")
      }

      const data = await response.json()
      setValidationData(data)
      setShowDeleteConfirm(true)
    } catch (error) {
      console.error("Error validating clients:", error)
      alert("Failed to validate clients. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleConfirmDelete = async (selectedIds: string[]) => {
    setIsDeleting(true)
    try {
      const response = await fetch("/api/clients/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientIds: selectedIds,
          action: "delete",
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete clients")
      }

      const result = await response.json()
      
      // Clear selection and refresh the page
      setSelectedClients(new Set())
      setShowDeleteConfirm(false)
      setValidationData(null)
      router.refresh()
      
      // Show success message
      alert(result.message || `Successfully deleted ${selectedIds.length} client(s)`)
    } catch (error) {
      console.error("Error deleting clients:", error)
      alert(error instanceof Error ? error.message : "Failed to delete clients. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  const hasSelection = selectedClients.size > 0

  return (
    <>
      {isAdmin && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedClients.size === clients.length && clients.length > 0}
              onCheckedChange={handleSelectAll}
              disabled={clients.length === 0}
            />
            <span className="text-sm text-gray-600">
              Select all ({clients.length} clients)
            </span>
          </div>
          {hasSelection && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {selectedClients.size} selected
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients.map((client) => (
          <div key={client.id} className="relative">
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
                  checked={selectedClients.has(client.id)}
                  onCheckedChange={() => handleToggle(client.id)}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                />
              </div>
            )}
            <Link href={`/dashboard/clients/${client.id}`}>
              <Card
                className={`hover:shadow-lg transition-shadow ${
                  !client.kycCompleted ? "border-yellow-500" : ""
                } ${selectedClients.has(client.id) ? "ring-2 ring-primary" : ""}`}
              >
                <CardHeader>
                  <CardTitle>{client.name}</CardTitle>
                  {client.company && (
                    <p className="text-sm text-gray-600">{client.company}</p>
                  )}
                </CardHeader>
                <CardContent>
                  {client.email && (
                    <p className="text-sm text-gray-600 mb-2">{client.email}</p>
                  )}
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>{client._count.proposals} proposals</span>
                    <span>{client._count.bills} invoices</span>
                    {client._count.projects > 0 && (
                      <span>{client._count.projects} projects</span>
                    )}
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
