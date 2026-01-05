"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

export default function NewBillPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [clients, setClients] = useState<Array<{ id: string; name: string; company?: string | null }>>([])
  const [proposals, setProposals] = useState<Array<{ id: string; title: string }>>([])
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
  const [formData, setFormData] = useState({
    proposalId: "",
    projectId: "",
    clientId: "",
    subtotal: "",
    taxInclusive: false,
    taxRate: "0",
    discountPercent: "",
    discountAmount: "",
    dueDate: "",
  })
  const [calculatedAmount, setCalculatedAmount] = useState(0)

  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => setClients(data))
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (formData.clientId) {
      Promise.all([
        fetch(`/api/proposals?clientId=${formData.clientId}`).then(res => res.json()).catch(() => []),
        fetch(`/api/projects?clientId=${formData.clientId}`).then(res => res.json()).catch(() => []),
      ])
        .then(([proposalsData, projectsData]) => {
          const approvedProposals = proposalsData.filter((p: any) => p.status === "APPROVED")
          setProposals(approvedProposals)
          setProjects(projectsData.filter((p: any) => !p.deletedAt))
        })
        .catch(console.error)
    } else {
      setProposals([])
      setProjects([])
      setFormData((prev) => ({ ...prev, proposalId: "", projectId: "" }))
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
              setFormData((prev) => ({ ...prev, subtotal: data.amount.toString() }))
            }
          })
          .catch(console.error)
      }
    }
  }, [formData.proposalId, proposals])

  // Calculate totals when tax/discount changes
  useEffect(() => {
    const subtotal = parseFloat(formData.subtotal) || 0
    const taxRate = parseFloat(formData.taxRate) || 0
    const discountPercent = parseFloat(formData.discountPercent) || 0
    const discountAmount = parseFloat(formData.discountAmount) || 0

    // Calculate discount
    let discountValue = 0
    if (discountPercent > 0) {
      discountValue = (subtotal * discountPercent) / 100
    } else if (discountAmount > 0) {
      discountValue = discountAmount
    }

    const afterDiscount = subtotal - discountValue

    // Calculate tax and final amount
    let finalAmount = afterDiscount
    if (taxRate > 0) {
      if (formData.taxInclusive) {
        // Tax is included, so final amount is afterDiscount
        finalAmount = afterDiscount
      } else {
        // Tax is added on top
        const taxAmount = (afterDiscount * taxRate) / 100
        finalAmount = afterDiscount + taxAmount
      }
    }

    setCalculatedAmount(finalAmount)
  }, [formData.subtotal, formData.taxRate, formData.taxInclusive, formData.discountPercent, formData.discountAmount])

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
          projectId: formData.projectId || undefined,
          clientId: formData.clientId,
          subtotal: formData.subtotal ? parseFloat(formData.subtotal) : undefined,
          taxInclusive: formData.taxInclusive,
          taxRate: formData.taxRate ? parseFloat(formData.taxRate) : null,
          discountPercent: formData.discountPercent ? parseFloat(formData.discountPercent) : null,
          discountAmount: formData.discountAmount ? parseFloat(formData.discountAmount) : null,
          dueDate: formData.dueDate || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Failed to create invoice")
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
      <h1 className="text-3xl font-bold mb-8">Create New Invoice</h1>
      <Card>
        <CardHeader>
          <CardTitle>Invoice Information</CardTitle>
          <CardDescription>Enter the invoice details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="clientId">Client *</Label>
              <Select
                id="clientId"
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value, proposalId: "", projectId: "" })}
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

            {formData.clientId && projects.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="projectId">From Project (Optional)</Label>
                <Select
                  id="projectId"
                  value={formData.projectId}
                  onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                >
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="subtotal">Subtotal (Original Amount) *</Label>
              <Input
                id="subtotal"
                type="number"
                step="0.01"
                min="0"
                value={formData.subtotal}
                onChange={(e) => setFormData({ ...formData, subtotal: e.target.value })}
                required
              />
              <p className="text-xs text-gray-500">Total amount before discount and tax</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description of Services/Products</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                placeholder="Describe the services or products being invoiced..."
              />
            </div>

            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold">Discount</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discountPercent">Discount Percentage (%)</Label>
                  <Input
                    id="discountPercent"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.discountPercent}
                    onChange={(e) => {
                      setFormData({ ...formData, discountPercent: e.target.value, discountAmount: "" })
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discountAmount">Discount Amount</Label>
                  <Input
                    id="discountAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.discountAmount}
                    onChange={(e) => {
                      setFormData({ ...formData, discountAmount: e.target.value, discountPercent: "" })
                    }}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">Enter either percentage or amount (not both)</p>
            </div>

            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold">Tax</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="taxInclusive"
                    checked={formData.taxInclusive}
                    onCheckedChange={(checked) => setFormData({ ...formData, taxInclusive: !!checked })}
                  />
                  <Label htmlFor="taxInclusive" className="cursor-pointer">
                    Tax is included in the amount
                  </Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <Select
                    id="taxRate"
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                  >
                    <option value="0">0%</option>
                    <option value="16">16%</option>
                    <option value="22">22%</option>
                    <option value="23">23%</option>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label>Calculated Total Amount</Label>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-lg font-semibold text-blue-800">
                  {formatCurrency(calculatedAmount)}
                </p>
              </div>
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
                {loading ? "Creating..." : "Create Invoice"}
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
