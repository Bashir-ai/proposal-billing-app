"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { Trash2, X } from "lucide-react"

interface DeleteButtonProps {
  itemId: string
  itemType: "proposal" | "project" | "invoice" | "client"
  itemName?: string
}

export function DeleteButton({ itemId, itemType, itemName }: DeleteButtonProps) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const getEndpoint = () => {
    switch (itemType) {
      case "proposal":
        return `/api/proposals/${itemId}`
      case "project":
        return `/api/projects/${itemId}`
      case "invoice":
        return `/api/bills/${itemId}`
      case "client":
        return `/api/clients/${itemId}`
      default:
        return ""
    }
  }

  const getItemLabel = () => {
    switch (itemType) {
      case "proposal":
        return "proposal"
      case "project":
        return "project"
      case "invoice":
        return "invoice"
      case "client":
        return "client"
      default:
        return "item"
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    setError("")

    try {
      const response = await fetch(getEndpoint(), {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        // If deletion is not allowed, show the reason
        if (data.message) {
          throw new Error(data.message)
        }
        throw new Error(data.error || "Failed to delete")
      }

      // Redirect to clients list for client deletion
      if (itemType === "client") {
        router.push("/dashboard/clients")
      } else {
        router.refresh()
      }
      setShowConfirm(false)
    } catch (err: any) {
      setError(err.message || "An error occurred while deleting")
    } finally {
      setLoading(false)
    }
  }

  if (showConfirm) {
    return (
      <Card className="border-red-200 bg-red-50" role="alertdialog" aria-labelledby="delete-confirm-title" aria-describedby="delete-confirm-desc">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle id="delete-confirm-title" className="text-lg text-red-900">Confirm Deletion</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowConfirm(false)
                setError("")
              }}
              className="h-8 w-8 p-0"
              aria-label="Close deletion dialog"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <CardDescription id="delete-confirm-desc" className="text-red-700">
            Are you sure you want to move this {getItemLabel()} to the junk box?
            {itemName && (
              <span className="block mt-1 font-semibold">{itemName}</span>
            )}
            <span className="block mt-2 text-sm">
              You can recover it later from Settings → Junk Box.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-sm text-red-800" role="alert">
              {error}
            </div>
          )}
          <div className="flex space-x-2">
            <Button
              onClick={handleDelete}
              disabled={loading}
              variant="destructive"
              aria-label={`Confirm deletion of ${itemName || getItemLabel()}`}
            >
              {loading ? "Deleting..." : "Yes, Move to Junk Box"}
            </Button>
            <Button
              onClick={() => {
                setShowConfirm(false)
                setError("")
              }}
              variant="outline"
              disabled={loading}
              aria-label="Cancel deletion"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Button
      onClick={() => setShowConfirm(true)}
      variant="destructive"
      size="sm"
      aria-label={`Delete ${itemName || getItemLabel()}`}
    >
      <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
      Delete
    </Button>
  )
}



