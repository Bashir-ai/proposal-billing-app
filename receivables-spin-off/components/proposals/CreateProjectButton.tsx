"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface CreateProjectButtonProps {
  proposalId: string
}

export function CreateProjectButton({ proposalId }: CreateProjectButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleCreate = async () => {
    setLoading(true)
    setError(null)

    try {
      // First, get the proposal to get clientId and title
      const proposalResponse = await fetch(`/api/proposals/${proposalId}`)
      if (!proposalResponse.ok) {
        throw new Error("Failed to fetch proposal")
      }
      const proposal = await proposalResponse.json()

      // Create project
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId: proposal.id,
          clientId: proposal.clientId,
          name: proposal.title,
          description: proposal.description || null,
          status: "ACTIVE",
          startDate: new Date().toISOString().split("T")[0],
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create project")
      }

      const project = await response.json()
      router.push(`/projects/${project.id}`)
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button onClick={handleCreate} disabled={loading} variant="outline">
        {loading ? "Creating..." : "Create Project"}
      </Button>
      {error && (
        <p className="text-sm text-red-600 mt-2">{error}</p>
      )}
    </div>
  )
}

