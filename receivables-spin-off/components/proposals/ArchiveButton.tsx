"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Archive, ArchiveRestore } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface ArchiveButtonProps {
  proposalId: string
  isArchived: boolean
}

export function ArchiveButton({ proposalId, isArchived }: ArchiveButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleArchive = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/proposals/${proposalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: isArchived ? "unarchive" : "archive" }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update archive status")
      }

      toast.success(isArchived ? "Proposal unarchived" : "Proposal archived")
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || "Failed to update archive status")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleArchive}
      disabled={loading}
      className="flex items-center gap-2"
    >
      {isArchived ? (
        <>
          <ArchiveRestore className="h-4 w-4" />
          {loading ? "Unarchiving..." : "Unarchive"}
        </>
      ) : (
        <>
          <Archive className="h-4 w-4" />
          {loading ? "Archiving..." : "Archive"}
        </>
      )}
    </Button>
  )
}
