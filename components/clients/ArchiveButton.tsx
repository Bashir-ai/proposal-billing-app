"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { Archive, ArchiveRestore, X } from "lucide-react"

interface ArchiveButtonProps {
  clientId: string
  clientName: string
  isArchived: boolean
}

export function ArchiveButton({ clientId, clientName, isArchived }: ArchiveButtonProps) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleArchive = async () => {
    setLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isArchived ? "unarchive" : "archive",
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || data.message || "Failed to archive/unarchive")
      }

      router.refresh()
      setShowConfirm(false)
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  if (showConfirm) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-blue-900">
              {isArchived ? "Unarchive Client" : "Archive Client"}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowConfirm(false)
                setError("")
              }}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription className="text-blue-700">
            {isArchived ? (
              <>
                Are you sure you want to unarchive this client?
                <span className="block mt-1 font-semibold">{clientName}</span>
                <span className="block mt-2 text-sm">
                  The client will be restored and visible in the clients list.
                </span>
              </>
            ) : (
              <>
                Are you sure you want to archive this client?
                <span className="block mt-1 font-semibold">{clientName}</span>
                <span className="block mt-2 text-sm">
                  The client will be hidden from the clients list but can be unarchived later.
                </span>
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-sm text-red-800">
              {error}
            </div>
          )}
          <div className="flex space-x-2">
            <Button
              onClick={handleArchive}
              disabled={loading}
              variant={isArchived ? "default" : "outline"}
            >
              {loading ? (isArchived ? "Unarchiving..." : "Archiving...") : (isArchived ? "Yes, Unarchive" : "Yes, Archive")}
            </Button>
            <Button
              onClick={() => {
                setShowConfirm(false)
                setError("")
              }}
              variant="outline"
              disabled={loading}
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
      variant="outline"
      size="sm"
    >
      {isArchived ? (
        <>
          <ArchiveRestore className="h-4 w-4 mr-2" />
          Unarchive
        </>
      ) : (
        <>
          <Archive className="h-4 w-4 mr-2" />
          Archive
        </>
      )}
    </Button>
  )
}

