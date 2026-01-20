"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash2 } from "lucide-react"
import { BulkDeleteDialog } from "@/components/clients/BulkDeleteDialog"
import { BillStatus } from "@prisma/client"
import { formatCurrency, formatDate } from "@/lib/utils"

interface Bill {
  id: string
  invoiceNumber?: string | null
  amount: number
  status: BillStatus
  dueDate?: Date | null
  client: {
    id: string
    name: string
    company?: string | null
  }
  proposal?: {
    title: string
  } | null
  project?: {
    id: string
    name: string
  } | null
}

interface InvoicesListProps {
  bills: Bill[]
  isAdmin: boolean
}

export function InvoicesList({ bills, isAdmin }: InvoicesListProps) {
  const router = useRouter()
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [validationData, setValidationData] = useState<{
    deletable: Array<{ id: string; name: string }>
    nonDeletable: Array<{ id: string; name: string; reason: string }>
  } | null>(null)

  const handleToggle = (billId: string) => {
    const newSelected = new Set(selectedBills)
    if (newSelected.has(billId)) {
      newSelected.delete(billId)
    } else {
      newSelected.add(billId)
    }
    setSelectedBills(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedBills.size === bills.length) {
      setSelectedBills(new Set())
    } else {
      setSelectedBills(new Set(bills.map((b) => b.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedBills.size === 0) return

    setIsDeleting(true)
    try {
      const billIds = Array.from(selectedBills)
      
      const response = await fetch("/api/bills/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          billIds,
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
      console.error("Error validating invoices:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to validate invoices. Please try again."
      alert(errorMessage)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleConfirmDelete = async (selectedIds: string[]) => {
    setIsDeleting(true)
    try {
      const response = await fetch("/api/bills/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          billIds: selectedIds,
          action: "delete",
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || "Failed to delete invoices")
      }

      const result = await response.json()
      
      setSelectedBills(new Set())
      setShowDeleteConfirm(false)
      setValidationData(null)
      router.refresh()
      
      alert(result.message || `Successfully deleted ${selectedIds.length} invoice(s)`)
    } catch (error) {
      console.error("Error deleting invoices:", error)
      alert(error instanceof Error ? error.message : "Failed to delete invoices. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  const hasSelection = selectedBills.size > 0

  const getStatusColor = (status: BillStatus) => {
    switch (status) {
      case "DRAFT":
        return "bg-gray-100 text-gray-800"
      case "SUBMITTED":
        return "bg-blue-100 text-blue-800"
      case "APPROVED":
        return "bg-green-100 text-green-800"
      case "PAID":
        return "bg-emerald-100 text-emerald-800"
      case "CANCELLED":
        return "bg-red-100 text-red-800"
      case "WRITTEN_OFF":
        return "bg-orange-100 text-orange-800"
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
              checked={selectedBills.size === bills.length && bills.length > 0}
              onCheckedChange={handleSelectAll}
              disabled={bills.length === 0}
            />
            <span className="text-sm text-gray-600">
              Select all ({bills.length} invoices)
            </span>
          </div>
          {hasSelection && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {selectedBills.size} selected
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

      <div className="space-y-6">
        {bills.map((bill) => (
          <div key={bill.id} className="relative">
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
                  checked={selectedBills.has(bill.id)}
                  onCheckedChange={() => handleToggle(bill.id)}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                />
              </div>
            )}
            <Link href={`/dashboard/bills/${bill.id}`}>
              <Card
                className={`hover:shadow-lg transition-shadow ${
                  selectedBills.has(bill.id) ? "ring-2 ring-primary" : ""
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold">
                          {formatCurrency(bill.amount)}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(bill.status)}`}>
                          {bill.status}
                        </span>
                        {bill.status !== "PAID" && bill.dueDate && new Date(bill.dueDate) < new Date() && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Outstanding
                          </span>
                        )}
                      </div>
                      {bill.invoiceNumber && (
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          Invoice #{bill.invoiceNumber}
                        </p>
                      )}
                      <p className="text-sm text-gray-600 mb-2">
                        Client: {bill.client.name}
                        {bill.client.company && ` (${bill.client.company})`}
                      </p>
                      {bill.proposal && (
                        <p className="text-sm text-gray-600 mb-1">
                          From proposal: {bill.proposal.title}
                        </p>
                      )}
                      {bill.project && (
                        <p className="text-sm text-gray-600 mb-1">
                          Project: {bill.project.name}
                        </p>
                      )}
                      {bill.dueDate && (
                        <p className="text-xs text-gray-500">
                          Due: {formatDate(bill.dueDate)}
                        </p>
                      )}
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
