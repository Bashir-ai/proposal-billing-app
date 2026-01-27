"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatClientName } from "@/lib/utils"

export default function NewProjectPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const proposalId = searchParams.get("proposalId")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [proposal, setProposal] = useState<any>(null)
  const [clients, setClients] = useState<Array<{ id: string; name: string; clientCode?: number | null; company?: string | null }>>([])
  const [formData, setFormData] = useState({
    clientId: "",
    name: "",
    description: "",
    status: "ACTIVE",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
  })

  useEffect(() => {
    if (proposalId) {
      fetch(`/api/proposals/${proposalId}`)
        .then((res) => res.json())
        .then((data) => {
          setProposal(data)
          setFormData((prev) => ({
            ...prev,
            clientId: data.clientId,
            name: `${data.title} - Project`,
            description: data.description || "",
          }))
        })
        .catch(console.error)
    }

    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => {
        // Handle paginated response
        const clientsArray = Array.isArray(data) 
          ? data 
          : (data.data && Array.isArray(data.data) ? data.data : [])
        setClients(clientsArray.filter((c: any) => c && !c.deletedAt && !c.archivedAt))
      })
      .catch(console.error)
  }, [proposalId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          proposalId: proposalId || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Failed to create project")
      } else {
        const project = await response.json()
        router.push(`/dashboard/projects/${project.id}`)
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">
        {proposalId ? "Convert Proposal to Project" : "Create New Project"}
      </h1>

      {proposal && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Source Proposal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{proposal.title}</p>
            {proposal.proposalNumber && (
              <p className="text-sm text-gray-600">Proposal #{proposal.proposalNumber}</p>
            )}
            {proposal.amount && (
              <p className="text-sm text-gray-600">Amount: ${proposal.amount?.toFixed(2)}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Project Information</CardTitle>
          <CardDescription>Enter the project details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">Client *</Label>
              <Select
                id="clientId"
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                required
                disabled={!!proposalId}
              >
                <option value="">Select a client</option>
                {Array.isArray(clients) && clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {formatClientName(client)} {client.company ? `(${client.company})` : ""}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date (Optional)</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                min={formData.startDate}
              />
            </div>

            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}

            <div className="flex space-x-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Project"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}


