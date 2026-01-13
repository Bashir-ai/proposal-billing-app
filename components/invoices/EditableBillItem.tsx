"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Edit, Save, X, Trash2 } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

interface BillItem {
  id: string
  type: string
  description: string
  quantity: number | null
  rate: number | null
  unitPrice: number | null
  discountPercent: number | null
  discountAmount: number | null
  amount: number
  billedHours: number | null
  isManuallyEdited: boolean
  personId: string | null
  date: Date | null
  person?: {
    id: string
    name: string
    email: string
  } | null
  timesheetEntryId: string | null
}

interface EditableBillItemProps {
  item: BillItem
  billId: string
  currency: string
  canEdit: boolean
  onUpdate: () => void
  users?: Array<{ id: string; name: string; email: string }>
}

export function EditableBillItem({
  item,
  billId,
  currency,
  canEdit,
  onUpdate,
  users = [],
}: EditableBillItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    description: item.description,
    quantity: item.quantity?.toString() || "",
    rate: item.rate?.toString() || "",
    unitPrice: item.unitPrice?.toString() || "",
    discountPercent: item.discountPercent?.toString() || "",
    discountAmount: item.discountAmount?.toString() || "",
    amount: item.amount.toString(),
    billedHours: item.billedHours?.toString() || "",
    personId: item.personId || "",
    date: item.date ? new Date(item.date).toISOString().split("T")[0] : "",
  })

  const handleSave = async () => {
    setError("")
    setLoading(true)

    try {
      const quantity = formData.quantity ? parseFloat(formData.quantity) : null
      const rate = formData.rate ? parseFloat(formData.rate) : null
      const unitPrice = formData.unitPrice ? parseFloat(formData.unitPrice) : null
      const discountPercent = formData.discountPercent ? parseFloat(formData.discountPercent) : null
      const discountAmount = formData.discountAmount ? parseFloat(formData.discountAmount) : null
      const billedHours = formData.billedHours ? parseFloat(formData.billedHours) : null

      // Calculate amount
      let calculatedAmount = parseFloat(formData.amount)
      if (quantity && (rate || unitPrice)) {
        const baseAmount = quantity * (rate || unitPrice || 0)
        const discount = discountAmount || (discountPercent ? (baseAmount * discountPercent / 100) : 0)
        calculatedAmount = baseAmount - discount
      }

      const response = await fetch(`/api/bills/${billId}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          description: formData.description,
          quantity,
          rate,
          unitPrice,
          discountPercent,
          discountAmount,
          amount: calculatedAmount,
          billedHours,
          personId: formData.personId || null,
          date: formData.date || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update item")
      }

      setIsEditing(false)
      onUpdate()
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this line item?")) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/bills/${billId}/items?itemId=${item.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete item")
      }

      onUpdate()
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  if (!canEdit) {
    // Read-only view
    return (
      <tr className={`border-b ${item.isCredit ? "bg-red-50" : ""}`}>
        <td className="p-2">
          <span className={`px-2 py-1 rounded text-xs ${
            item.isCredit ? "bg-red-100 text-red-800" : "bg-gray-100"
          }`}>
            {item.isCredit ? "CREDIT" : item.type}
            {item.isManuallyEdited && (
              <span className="ml-1 text-blue-600" title="Manually edited">✎</span>
            )}
          </span>
        </td>
        <td className="p-2">
          {item.date ? formatDate(item.date) : "-"}
        </td>
        <td className="p-2">
          {item.person ? item.person.name : "-"}
        </td>
        <td className="p-2">{item.description}</td>
        <td className="p-2 text-right">
          {item.billedHours !== null && item.billedHours !== undefined
            ? `${item.billedHours.toFixed(2)}h`
            : item.quantity !== null && item.quantity !== undefined
            ? item.quantity.toFixed(2)
            : "-"}
          {item.type === "TIMESHEET" && item.billedHours !== null && item.timesheetEntryId && (
            <span className="text-xs text-gray-500 ml-1" title="Billed hours (may differ from timesheet)">
              *
            </span>
          )}
        </td>
        <td className="p-2 text-right">
          {item.rate !== null && item.rate !== undefined
            ? formatCurrency(item.rate, currency)
            : item.unitPrice !== null && item.unitPrice !== undefined
            ? formatCurrency(Math.abs(item.unitPrice), currency)
            : "-"}
        </td>
        <td className={`p-2 text-right font-semibold ${item.isCredit ? "text-red-600" : ""}`}>
          {item.isCredit ? "-" : ""}{formatCurrency(Math.abs(item.amount), currency)}
        </td>
      </tr>
    )
  }

  if (isEditing) {
    return (
      <tr className="border-b bg-blue-50">
        <td colSpan={7} className="p-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  required
                />
              </div>
              {item.type === "TIMESHEET" && (
                <div className="space-y-2">
                  <Label>Billed Hours</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.billedHours}
                    onChange={(e) => setFormData({ ...formData, billedHours: e.target.value })}
                    placeholder="Hours to bill"
                  />
                  <p className="text-xs text-gray-500">
                    Adjust billed hours without affecting the original timesheet entry
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Rate</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Unit Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Discount %</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.discountPercent}
                  onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Discount Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.discountAmount}
                  onChange={(e) => setFormData({ ...formData, discountAmount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>
              {users.length > 0 && (
                <div className="space-y-2">
                  <Label>Person</Label>
                  <select
                    className="w-full px-3 py-2 border rounded-md"
                    value={formData.personId}
                    onChange={(e) => setFormData({ ...formData, personId: e.target.value })}
                  >
                    <option value="">None</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
            </div>
            {error && (
              <div className="text-sm text-red-600">{error}</div>
            )}
            <div className="flex space-x-2">
              <Button onClick={handleSave} disabled={loading} size="sm">
                <Save className="h-4 w-4 mr-2" />
                {loading ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false)
                  setError("")
                }}
                disabled={loading}
                size="sm"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              {item.type === "MANUAL" && (
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading}
                  size="sm"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className={`border-b ${item.isCredit ? "bg-red-50" : ""}`}>
      <td className="p-2">
        <span className={`px-2 py-1 rounded text-xs ${
          item.isCredit ? "bg-red-100 text-red-800" : "bg-gray-100"
        }`}>
          {item.isCredit ? "CREDIT" : item.type}
          {item.isManuallyEdited && (
            <span className="ml-1 text-blue-600" title="Manually edited">✎</span>
          )}
        </span>
      </td>
      <td className="p-2">
        {item.date ? formatDate(item.date) : "-"}
      </td>
      <td className="p-2">
        {item.person ? item.person.name : "-"}
      </td>
      <td className="p-2">{item.description}</td>
      <td className="p-2 text-right">
        {item.billedHours !== null && item.billedHours !== undefined
          ? `${item.billedHours.toFixed(2)}h`
          : item.quantity !== null && item.quantity !== undefined
          ? item.quantity.toFixed(2)
          : "-"}
        {item.type === "TIMESHEET" && item.billedHours !== null && item.timesheetEntryId && (
          <span className="text-xs text-gray-500 ml-1" title="Billed hours (may differ from timesheet)">
            *
          </span>
        )}
      </td>
      <td className="p-2 text-right">
        {item.rate !== null && item.rate !== undefined
          ? formatCurrency(item.rate, currency)
          : item.unitPrice !== null && item.unitPrice !== undefined
          ? formatCurrency(Math.abs(item.unitPrice), currency)
          : "-"}
      </td>
      <td className={`p-2 text-right font-semibold ${item.isCredit ? "text-red-600" : ""}`}>
        {item.isCredit ? "-" : ""}{formatCurrency(Math.abs(item.amount), currency)}
      </td>
      <td className="p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(true)}
          className="h-8 w-8 p-0"
        >
          <Edit className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  )
}
