"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Plus, Edit, Trash2, Gift } from "lucide-react"

interface Benefit {
  id: string
  description: string
  amount: number
  currency: string
  benefitDate: string
  category: "HEALTH" | "TRANSPORT" | "MEAL" | "OTHER"
  createdAt: string
  creator: {
    id: string
    name: string
    email: string
  }
}

interface BenefitsSectionProps {
  userId: string
  startDate: string | null
  endDate: string | null
  isAdmin: boolean
}

export function BenefitsSection({ userId, startDate, endDate, isAdmin }: BenefitsSectionProps) {
  const [benefits, setBenefits] = useState<Benefit[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingBenefit, setEditingBenefit] = useState<Benefit | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    currency: "EUR",
    benefitDate: new Date().toISOString().split("T")[0],
    category: "OTHER" as "HEALTH" | "TRANSPORT" | "MEAL" | "OTHER",
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchBenefits()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, startDate, endDate, selectedCategory])

  const fetchBenefits = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (startDate) params.set("startDate", startDate)
      if (endDate) params.set("endDate", endDate)
      if (selectedCategory) params.set("category", selectedCategory)

      const response = await fetch(`/api/users/${userId}/fringe-benefits?${params.toString()}`)
      const data = await response.json()
      setBenefits(data.benefits || [])
    } catch (error) {
      console.error("Error fetching benefits:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingBenefit(null)
    setFormData({
      description: "",
      amount: "",
      currency: "EUR",
      benefitDate: new Date().toISOString().split("T")[0],
      category: "OTHER",
    })
    setShowCreateModal(true)
  }

  const handleEdit = (benefit: Benefit) => {
    setEditingBenefit(benefit)
    setFormData({
      description: benefit.description,
      amount: benefit.amount.toString(),
      currency: benefit.currency,
      benefitDate: new Date(benefit.benefitDate).toISOString().split("T")[0],
      category: benefit.category,
    })
    setShowCreateModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const url = editingBenefit
        ? `/api/users/${userId}/fringe-benefits/${editingBenefit.id}`
        : `/api/users/${userId}/fringe-benefits`
      const method = editingBenefit ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || "Failed to save benefit")
        return
      }

      setShowCreateModal(false)
      await fetchBenefits()
    } catch (error) {
      console.error("Error saving benefit:", error)
      alert("Failed to save benefit")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (benefitId: string) => {
    if (!confirm("Are you sure you want to delete this benefit?")) return

    try {
      const response = await fetch(`/api/users/${userId}/fringe-benefits/${benefitId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || "Failed to delete benefit")
        return
      }

      await fetchBenefits()
    } catch (error) {
      console.error("Error deleting benefit:", error)
      alert("Failed to delete benefit")
    }
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "HEALTH": return "Health"
      case "TRANSPORT": return "Transport"
      case "MEAL": return "Meal"
      case "OTHER": return "Other"
      default: return category
    }
  }

  if (loading) {
    return <div>Loading benefits...</div>
  }

  const totalBenefits = benefits.reduce((sum, b) => sum + b.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Fringe Benefits</h3>
          <p className="text-sm text-gray-600">Benefits provided by the office (for control, no credit/debit)</p>
        </div>
        {isAdmin && (
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Benefit
          </Button>
        )}
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-4">
        <Label>Filter by Category:</Label>
        <Select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="min-w-[150px]"
        >
          <option value="">All Categories</option>
          <option value="HEALTH">Health</option>
          <option value="TRANSPORT">Transport</option>
          <option value="MEAL">Meal</option>
          <option value="OTHER">Other</option>
        </Select>
      </div>

      {/* Total Benefits */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-gray-500" />
              <span className="text-sm text-gray-600">Total Benefits (Selected Period):</span>
            </div>
            <span className="text-2xl font-bold">{formatCurrency(totalBenefits)}</span>
          </div>
        </CardContent>
      </Card>

      {benefits.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-gray-500">No benefits found for the selected period.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {benefits.map((benefit) => (
            <Card key={benefit.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <h4 className="font-semibold">{benefit.description}</h4>
                      <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">
                        {getCategoryLabel(benefit.category)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Amount:</span>
                        <div className="font-semibold">{formatCurrency(benefit.amount)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Date:</span>
                        <div className="font-semibold">{formatDate(benefit.benefitDate)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Created By:</span>
                        <div className="font-semibold">{benefit.creator.name}</div>
                      </div>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(benefit)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(benefit.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl m-4">
            <CardHeader>
              <CardTitle>{editingBenefit ? "Edit Benefit" : "Create Benefit"}</CardTitle>
              <CardDescription>
                {editingBenefit ? "Update benefit details" : "Create a new fringe benefit"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Description *</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    >
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Benefit Date *</Label>
                    <Input
                      type="date"
                      value={formData.benefitDate}
                      onChange={(e) => setFormData({ ...formData, benefitDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <Select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as "HEALTH" | "TRANSPORT" | "MEAL" | "OTHER" })}
                    >
                      <option value="HEALTH">Health</option>
                      <option value="TRANSPORT">Transport</option>
                      <option value="MEAL">Meal</option>
                      <option value="OTHER">Other</option>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Saving..." : editingBenefit ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
