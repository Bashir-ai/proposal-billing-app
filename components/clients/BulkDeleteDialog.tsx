"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"

interface DeletableClient {
  id: string
  name: string
}

interface NonDeletableClient {
  id: string
  name: string
  reason: string
}

interface BulkDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deletable: DeletableClient[]
  nonDeletable: NonDeletableClient[]
  onConfirm: (selectedIds: string[]) => Promise<void>
  isDeleting?: boolean
}

export function BulkDeleteDialog({
  open,
  onOpenChange,
  deletable,
  nonDeletable,
  onConfirm,
  isDeleting = false,
}: BulkDeleteDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(deletable.map((c) => c.id))
  )

  // Update selectedIds when deletable list changes
  useEffect(() => {
    if (open && deletable.length > 0) {
      setSelectedIds(new Set(deletable.map((c) => c.id)))
    }
  }, [open, deletable])

  const handleToggle = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedIds.size === deletable.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(deletable.map((c) => c.id)))
    }
  }

  const handleConfirm = async () => {
    if (selectedIds.size === 0) return
    await onConfirm(Array.from(selectedIds))
    setSelectedIds(new Set(deletable.map((c) => c.id)))
  }

  const handleCancel = () => {
    setSelectedIds(new Set(deletable.map((c) => c.id)))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirm Bulk Delete</DialogTitle>
          <DialogDescription>
            Review the clients below. You can deselect any clients you don't want to delete.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {deletable.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <h3 className="font-semibold text-sm">
                    Can be deleted ({deletable.length})
                  </h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={isDeleting}
                >
                  {selectedIds.size === deletable.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                {deletable.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded"
                  >
                    <Checkbox
                      checked={selectedIds.has(client.id)}
                      onCheckedChange={() => handleToggle(client.id)}
                      disabled={isDeleting}
                    />
                    <label className="flex-1 text-sm cursor-pointer">
                      {client.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {nonDeletable.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <h3 className="font-semibold text-sm">
                  Cannot be deleted ({nonDeletable.length})
                </h3>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                {nonDeletable.map((client) => (
                  <Alert key={client.id} variant="destructive" className="py-2 border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-sm text-red-800">
                      <strong>{client.name}</strong>: {client.reason}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          {deletable.length === 0 && nonDeletable.length === 0 && (
            <Alert>
              <AlertDescription>
                No clients selected for deletion.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={selectedIds.size === 0 || isDeleting}
          >
            {isDeleting
              ? "Deleting..."
              : `Delete ${selectedIds.size} client${selectedIds.size !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
