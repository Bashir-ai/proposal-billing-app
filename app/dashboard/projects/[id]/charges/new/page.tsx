"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export default function NewChargePage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    quantity: "1",
    unitPrice: "",
    chargeType: "ONE_TIME" as "ONE_TIME" | "RECURRING",
    recurringFrequency: "" as "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" | "",
    startDate: "",
    endDate: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSubmitting(true)

    // Validate
    if (!formData.description.trim()) {
      setError("Description is required")
      setSubmitting(false)
      return
    }

    // Calculate amount if quantity and unitPrice provided
    let amount = formData.amount ? parseFloat(formData.amount) : null
    if (!amount && formData.quantity && formData.unitPrice) {
      const quantity = parseFloat(formData.quantity)
      const unitPrice = parseFloat(formData.unitPrice)
      if (!isNaN(quantity) && !isNaN(unitPrice) && quantity > 0 && unitPrice > 0) {
        amount = quantity * unitPrice
      }
    }

    if (!amount || amount <= 0) {
      setError("Amount is required (either directly or via quantity × unit price)")
      setSubmitting(false)
      return
    }

    // Validate recurring charge requirements
    if (formData.chargeType === "RECURRING") {
      if (!formData.recurringFrequency) {
        setError("Recurring frequency is required for recurring charges")
        setSubmitting(false)
        return
      }
      if (!formData.startDate) {
        setError("Start date is required for recurring charges")
        setSubmitting(false)
        return
      }
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/charges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: formData.description,
          amount: amount,
          quantity: formData.quantity ? parseFloat(formData.quantity) : undefined,
          unitPrice: formData.unitPrice ? parseFloat(formData.unitPrice) : undefined,
          chargeType: formData.chargeType,
          recurringFrequency: formData.recurringFrequency || undefined,
          startDate: formData.startDate || undefined,
          endDate: formData.endDate || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create charge")
      }

      router.push(`/dashboard/projects/${projectId}`)
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Add Charge</h1>
      <Card>
        <CardHeader>
          <CardTitle>New Project Charge</CardTitle>
          <CardDescription>Add a chargeable item to this project</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Describe the charge..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="chargeType">Charge Type *</Label>
              <Select
                id="chargeType"
                value={formData.chargeType}
                onChange={(e) => setFormData({ ...formData, chargeType: e.target.value as "ONE_TIME" | "RECURRING" })}
                required
              >
                <option value="ONE_TIME">One-Time Charge</option>
                <option value="RECURRING">Recurring Charge</option>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Or use quantity × price"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitPrice">Unit Price</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                  placeholder="Price per unit"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Provide either amount directly, or quantity × unit price (amount will be calculated)
            </p>

            {formData.chargeType === "RECURRING" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="recurringFrequency">Recurring Frequency *</Label>
                  <Select
                    id="recurringFrequency"
                    value={formData.recurringFrequency}
                    onChange={(e) => setFormData({ ...formData, recurringFrequency: e.target.value as any })}
                    required
                  >
                    <option value="">Select frequency</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="YEARLY">Yearly</option>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}

            <div className="flex space-x-4">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create Charge"}
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



