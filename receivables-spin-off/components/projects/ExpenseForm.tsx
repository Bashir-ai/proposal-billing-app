"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency } from "@/lib/utils"

interface ExpenseFormProps {
  projectId: string
  onSuccess?: () => void
  onCancel?: () => void
  initialData?: {
    id: string
    description: string
    amount: number
    currency: string
    expenseDate: string
    category: string | null
    receiptPath: string | null
    isBillable: boolean
    isReimbursement: boolean
  } | null
}

export function ExpenseForm({ projectId, onSuccess, onCancel, initialData }: ExpenseFormProps) {
  const [formData, setFormData] = useState({
    description: initialData?.description || "",
    amount: initialData?.amount?.toString() || "",
    currency: initialData?.currency || "EUR",
    expenseDate: initialData?.expenseDate 
      ? new Date(initialData.expenseDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    category: initialData?.category || "",
    receiptPath: initialData?.receiptPath || "",
    isBillable: initialData?.isBillable || false,
    isReimbursement: initialData?.isReimbursement || false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const url = initialData
        ? `/api/projects/${projectId}/expenses/${initialData.id}`
        : `/api/projects/${projectId}/expenses`
      const method = initialData ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          category: formData.category || null,
          receiptPath: formData.receiptPath || null,
          projectId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || "Failed to save expense")
        return
      }

      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error("Error saving expense:", error)
      setError(error.message || "Failed to save expense")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData ? "Edit Expense" : "Create Expense"}</CardTitle>
        <CardDescription>
          {initialData ? "Update expense details" : "Add a new expense to this project"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              rows={3}
              placeholder="Describe the expense..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="space-y-2">
              <Label>Expense Date *</Label>
              <Input
                type="date"
                value={formData.expenseDate}
                onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category (Optional)</Label>
            <Input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g., Travel, Supplies, Software"
            />
          </div>

          <div className="space-y-2">
            <Label>Receipt Path (Optional)</Label>
            <Input
              type="text"
              value={formData.receiptPath}
              onChange={(e) => setFormData({ ...formData, receiptPath: e.target.value })}
              placeholder="Path to receipt file"
            />
            <p className="text-xs text-gray-500">Note: File upload functionality can be added later</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isBillable"
                checked={formData.isBillable}
                onChange={(e) => setFormData({ ...formData, isBillable: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="isBillable" className="cursor-pointer">
                Billable to Client
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isReimbursement"
                checked={formData.isReimbursement}
                onChange={(e) => setFormData({ ...formData, isReimbursement: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="isReimbursement" className="cursor-pointer">
                Reimbursement Required
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : initialData ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
