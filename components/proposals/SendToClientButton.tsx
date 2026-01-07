"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface SendToClientButtonProps {
  proposalId: string
}

export function SendToClientButton({ proposalId }: SendToClientButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSend = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/proposals/${proposalId}/send-client-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to send email")
      }

      router.refresh()
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button onClick={handleSend} disabled={loading} variant="outline">
        {loading ? "Sending..." : "Send to Client"}
      </Button>
      {error && (
        <p className="text-sm text-red-600 mt-2">{error}</p>
      )}
    </div>
  )
}





