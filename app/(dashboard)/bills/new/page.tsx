"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

export default function NewBillPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [clients, setClients] = useState<Array<{ id: string; name: string; company?: string | null }>>([])
  const [proposals, setProposals] = useState<Array<{ id: string; title: string }>>([])
  const [formData, setFormData] = useState({
    proposalId: "",
    clientId: "",
    amount: "",
    dueDate: "",
  })

  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => setClients(data))
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (formData.clientId) {
      fetch(`/api/proposals?clientId=${formData.clientId}`)
        .then((res) => res.json())
        .then((data) => {
          const approvedProposals = data.filter((p: any) => p.status === "APPROVED")
          setProposals(approvedProposals)
        })
        .catch(console.error)
    } else {
      setProposals([])
      setFormData((prev) => ({ ...prev, proposalId: "" }))
    }
  }, [formData.clientId])

  useEffect(() => {
    if (formData.proposalId && proposals.length > 0) {
      const proposal = proposals.find((p) => p.id === formData.proposalId)
      if (proposal) {
        fetch(`/api/proposals/${formData.proposalId}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.amount) {
              setFormData((prev) => ({ ...prev, amount: data.amount.toString() }))
            }
          })
          .catch(console.error)
      }
    }
  }, [formData.proposalId, proposals])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId: formData.proposalId || undefined,
          clientId: formData.clientId,
          amount: parseFloat(formData.amount),
          dueDate: formData.dueDate || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Failed to create bill")
      } else {
        const bill = await response.json()
        router.push(`/dashboard/bills/${bill.id}`)
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Create New Bill</h1>
      <Card>
        <CardHeader>
          <CardTitle>Bill Information</CardTitle>
          <CardDescription>Enter the bill details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">Client *</Label>
              <Select
                id="clientId"
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value, proposalId: "" })}
                required
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} {client.company ? `(${client.company})` : ""}
                  </option>
                ))}
              </Select>
            </div>

            {formData.clientId && proposals.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="proposalId">From Proposal (Optional)</Label>
                <Select
                  id="proposalId"
                  value={formData.proposalId}
                  onChange={(e) => setFormData({ ...formData, proposalId: e.target.value })}
                >
                  <option value="">No proposal</option>
                  {proposals.map((proposal) => (
                    <option key={proposal.id} value={proposal.id}>
                      {proposal.title}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
              {formData.amount && (
                <p className="text-sm text-gray-600">
                  {formatCurrency(parseFloat(formData.amount) || 0)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>

            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}

            <div className="flex space-x-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Bill"}
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




