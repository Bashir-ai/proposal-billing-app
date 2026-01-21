"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatDate, formatCurrency } from "@/lib/utils"
import { Trash2, RotateCcw, AlertCircle } from "lucide-react"

interface DeletedProposal {
  id: string
  title: string
  proposalNumber?: string | null
  deletedAt: string
  client: {
    name: string
    company?: string | null
  }
  creator: {
    name: string
  }
}

interface DeletedProject {
  id: string
  name: string
  deletedAt: string
  client: {
    name: string
    company?: string | null
  }
  proposal?: {
    title: string
    proposalNumber?: string | null
  } | null
}

interface DeletedBill {
  id: string
  invoiceNumber?: string | null
  amount: number
  deletedAt: string
  client: {
    name: string
    company?: string | null
  }
  creator: {
    name: string
  }
  proposal?: {
    title: string
    proposalNumber?: string | null
  } | null
}

interface JunkBoxData {
  proposals: DeletedProposal[]
  projects: DeletedProject[]
  bills: DeletedBill[]
}

export function JunkBox() {
  const [data, setData] = useState<JunkBoxData>({ proposals: [], projects: [], bills: [] })
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [showEmptyDialog, setShowEmptyDialog] = useState(false)
  const [emptying, setEmptying] = useState(false)

  const fetchJunkBox = async () => {
    try {
      setLoading(true)
      setError("")
      const response = await fetch("/api/junkbox", {
        cache: "no-store", // Ensure fresh data
      })
      if (response.ok) {
        const junkBoxData = await response.json()
        // Ensure data structure is valid
        setData({
          proposals: Array.isArray(junkBoxData.proposals) ? junkBoxData.proposals : [],
          projects: Array.isArray(junkBoxData.projects) ? junkBoxData.projects : [],
          bills: Array.isArray(junkBoxData.bills) ? junkBoxData.bills : [],
        })
      } else {
        const errorData = await response.json().catch(() => ({ error: "Failed to load junk box" }))
        setError(errorData.error || errorData.details || "Failed to load junk box")
        // Set empty data on error to prevent crashes
        setData({ proposals: [], projects: [], bills: [] })
      }
    } catch (err: any) {
      console.error("Error fetching junk box:", err)
      setError(err.message || "Failed to load junk box. Please try again.")
      // Set empty data on error to prevent crashes
      setData({ proposals: [], projects: [], bills: [] })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJunkBox()
  }, [])

  const handleRestore = async (itemId: string, itemType: "proposal" | "project" | "invoice") => {
    setRestoring(itemId)
    setError("")
    setSuccess("")

    try {
      const endpoint = `/api/${itemType === "invoice" ? "bills" : itemType === "proposal" ? "proposals" : "projects"}/${itemId}/restore`
      const response = await fetch(endpoint, {
        method: "POST",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to restore")
      }

      setSuccess(`${itemType} restored successfully`)
      fetchJunkBox()
    } catch (err: any) {
      setError(err.message || "Failed to restore")
    } finally {
      setRestoring(null)
    }
  }

  const handlePermanentDelete = async (itemId: string, itemType: "proposal" | "project" | "invoice") => {
    if (!confirm(`Are you sure you want to permanently delete this ${itemType}? This action cannot be undone.`)) {
      return
    }

    setDeleting(itemId)
    setError("")
    setSuccess("")

    try {
      const endpoint = `/api/${itemType === "invoice" ? "bills" : itemType === "proposal" ? "proposals" : "projects"}/${itemId}/permanent-delete`
      const response = await fetch(endpoint, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete")
      }

      setSuccess(`${itemType} permanently deleted`)
      fetchJunkBox()
    } catch (err: any) {
      setError(err.message || "Failed to delete")
    } finally {
      setDeleting(null)
    }
  }

  const handleEmptyJunkBox = async () => {
    setEmptying(true)
    setError("")
    setSuccess("")

    try {
      const response = await fetch("/api/junkbox/empty", {
        method: "POST",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || data.message || "Failed to empty junk box")
      }

      const result = await response.json()
      setSuccess(result.message || "Junk box emptied successfully")
      setShowEmptyDialog(false)
      fetchJunkBox()
    } catch (err: any) {
      setError(err.message || "Failed to empty junk box")
    } finally {
      setEmptying(false)
    }
  }

  if (loading) {
    return <div>Loading junk box...</div>
  }

  const totalItems = data.proposals.length + data.projects.length + data.bills.length

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded text-green-700">
          {success}
        </div>
      )}

      {totalItems > 0 && (
        <div className="flex justify-end">
          <Button
            variant="destructive"
            onClick={() => setShowEmptyDialog(true)}
            disabled={emptying}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Empty Junk Box
          </Button>
        </div>
      )}

      {totalItems === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">Junk box is empty</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Proposals Section */}
          {data.proposals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Deleted Proposals ({data.proposals.length})</CardTitle>
                <CardDescription>Proposals that have been moved to the junk box</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.proposals.map((proposal) => (
                    <div
                      key={proposal.id}
                      className="p-4 border rounded-lg flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <h4 className="font-semibold">{proposal.title}</h4>
                        {proposal.proposalNumber && (
                          <p className="text-sm text-gray-600">#{proposal.proposalNumber}</p>
                        )}
                        <p className="text-sm text-gray-600">
                          Client: {proposal.client?.name || "Unknown Client"}
                          {proposal.client?.company && ` (${proposal.client.company})`}
                        </p>
                        <p className="text-sm text-gray-600">
                          Created by: {proposal.creator?.name || "Unknown User"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Deleted: {formatDate(proposal.deletedAt)}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => handleRestore(proposal.id, "proposal")}
                          disabled={restoring === proposal.id}
                          variant="outline"
                          size="sm"
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          {restoring === proposal.id ? "Restoring..." : "Restore"}
                        </Button>
                        <Button
                          onClick={() => handlePermanentDelete(proposal.id, "proposal")}
                          disabled={deleting === proposal.id}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {deleting === proposal.id ? "Deleting..." : "Permanently Delete"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Projects Section */}
          {data.projects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Deleted Projects ({data.projects.length})</CardTitle>
                <CardDescription>Projects that have been moved to the junk box</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.projects.map((project) => (
                    <div
                      key={project.id}
                      className="p-4 border rounded-lg flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <h4 className="font-semibold">{project.name}</h4>
                        {project.proposal && (
                          <p className="text-sm text-gray-600">
                            From proposal: {project.proposal.title}
                            {project.proposal.proposalNumber && ` (#${project.proposal.proposalNumber})`}
                          </p>
                        )}
                        <p className="text-sm text-gray-600">
                          Client: {project.client?.name || "Unknown Client"}
                          {project.client?.company && ` (${project.client.company})`}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Deleted: {formatDate(project.deletedAt)}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => handleRestore(project.id, "project")}
                          disabled={restoring === project.id}
                          variant="outline"
                          size="sm"
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          {restoring === project.id ? "Restoring..." : "Restore"}
                        </Button>
                        <Button
                          onClick={() => handlePermanentDelete(project.id, "project")}
                          disabled={deleting === project.id}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {deleting === project.id ? "Deleting..." : "Permanently Delete"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Invoices Section */}
          {data.bills.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Deleted Invoices ({data.bills.length})</CardTitle>
                <CardDescription>Invoices that have been moved to the junk box</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.bills.map((bill) => (
                    <div
                      key={bill.id}
                      className="p-4 border rounded-lg flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <h4 className="font-semibold">
                          {bill.invoiceNumber ? `Invoice #${bill.invoiceNumber}` : `Invoice ${bill.id.slice(0, 8)}`}
                        </h4>
                        <p className="text-sm text-gray-600">
                          Amount: {formatCurrency(bill.amount)}
                        </p>
                        {bill.proposal && (
                          <p className="text-sm text-gray-600">
                            From proposal: {bill.proposal.title}
                            {bill.proposal.proposalNumber && ` (#${bill.proposal.proposalNumber})`}
                          </p>
                        )}
                        <p className="text-sm text-gray-600">
                          {bill.client ? "Client" : "Lead"}: {bill.client?.name || bill.lead?.name || "Unknown"}
                          {(bill.client?.company || bill.lead?.company) && ` (${bill.client?.company || bill.lead?.company})`}
                        </p>
                        <p className="text-sm text-gray-600">
                          Created by: {bill.creator?.name || "Unknown User"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Deleted: {formatDate(bill.deletedAt)}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => handleRestore(bill.id, "invoice")}
                          disabled={restoring === bill.id}
                          variant="outline"
                          size="sm"
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          {restoring === bill.id ? "Restoring..." : "Restore"}
                        </Button>
                        <Button
                          onClick={() => handlePermanentDelete(bill.id, "invoice")}
                          disabled={deleting === bill.id}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {deleting === bill.id ? "Deleting..." : "Permanently Delete"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={showEmptyDialog} onOpenChange={setShowEmptyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Empty Junk Box</DialogTitle>
            <DialogDescription>
              This will permanently delete all items in the junk box. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 mb-4">
              The following items will be permanently deleted:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm">
              {data.proposals.length > 0 && (
                <li>{data.proposals.length} proposal(s)</li>
              )}
              {data.projects.length > 0 && (
                <li>{data.projects.length} project(s)</li>
              )}
              {data.bills.length > 0 && (
                <li>{data.bills.length} invoice(s)</li>
              )}
            </ul>
            {totalItems === 0 && (
              <p className="text-sm text-gray-500 mt-4">No items to delete.</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEmptyDialog(false)}
              disabled={emptying}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleEmptyJunkBox}
              disabled={emptying || totalItems === 0}
            >
              {emptying ? "Emptying..." : "Empty Junk Box"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

