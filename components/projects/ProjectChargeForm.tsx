"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { X } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
interface ProjectCharge {
  id?: string
  description: string
  amount?: number
  quantity?: number | null
  unitPrice?: number | null
  chargeType: "ONE_TIME" | "RECURRING"
  recurringFrequency?: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" | null
  startDate?: string | Date | null
  endDate?: string | Date | null
}

interface ProposalItem {
  id: string
  description: string
  quantity: number | null
  unitPrice: number | null
  amount: number
  billingMethod?: string | null
}

interface ProjectChargeFormProps {
  projectId: string
  charge?: ProjectCharge | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  proposalItems?: ProposalItem[]
  currency?: string
}

export function ProjectChargeForm({
  projectId,
  charge,
  isOpen,
  onClose,
  onSuccess,
  proposalItems = [],
  currency = "EUR",
}: ProjectChargeFormProps) {
  const [formData, setFormData] = useState<ProjectCharge>({
    description: charge?.description || "",
    amount: charge?.amount,
    quantity: charge?.quantity || 1,
    unitPrice: charge?.unitPrice,
    chargeType: charge?.chargeType || "ONE_TIME",
    recurringFrequency: charge?.recurringFrequency || null,
    startDate: charge?.startDate || null,
    endDate: charge?.endDate || null,
  })
  const [useQuantityPrice, setUseQuantityPrice] = useState<boolean>(!!(!charge?.amount && (charge?.quantity || charge?.unitPrice)))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedProposalItemId, setSelectedProposalItemId] = useState<string>("")

  useEffect(() => {
    if (charge) {
      setFormData({
        description: charge.description,
        amount: charge.amount,
        quantity: charge.quantity || 1,
        unitPrice: charge.unitPrice,
        chargeType: charge.chargeType,
        recurringFrequency: charge.recurringFrequency || null,
        startDate: charge.startDate || null,
        endDate: charge.endDate || null,
      })
      setUseQuantityPrice(!!(!charge.amount && (charge.quantity || charge.unitPrice)))
    } else {
      setFormData({
        description: "",
        amount: undefined,
        quantity: 1,
        unitPrice: undefined,
        chargeType: "ONE_TIME",
        recurringFrequency: null,
        startDate: null,
        endDate: null,
      })
      setUseQuantityPrice(false)
    }
  }, [charge])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Calculate amount if using quantity × unitPrice
      let finalAmount = formData.amount
      if (useQuantityPrice && formData.quantity && formData.unitPrice) {
        finalAmount = formData.quantity * formData.unitPrice
      }

      if (!finalAmount || finalAmount <= 0) {
        throw new Error("Amount is required and must be greater than 0")
      }

      const payload: any = {
        description: formData.description,
        chargeType: formData.chargeType,
      }

      if (useQuantityPrice) {
        payload.quantity = formData.quantity
        payload.unitPrice = formData.unitPrice
      } else {
        payload.amount = finalAmount
      }

      if (formData.chargeType === "RECURRING") {
        if (!formData.recurringFrequency) {
          throw new Error("Recurring frequency is required for recurring charges")
        }
        if (!formData.startDate) {
          throw new Error("Start date is required for recurring charges")
        }
        payload.recurringFrequency = formData.recurringFrequency
        payload.startDate = formData.startDate
        payload.endDate = formData.endDate || null
      }

      const url = charge?.id
        ? `/api/projects/${projectId}/charges/${charge.id}`
        : `/api/projects/${projectId}/charges`
      
      const method = charge?.id ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save project charge")
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const calculatedAmount = useQuantityPrice && formData.quantity && formData.unitPrice
    ? formData.quantity * formData.unitPrice
    : formData.amount || 0

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{charge ? "Edit Project Charge" : "Add Project Charge"}</CardTitle>
              <CardDescription>Add a fixed charge to this project</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            {proposalItems.length > 0 && !charge && (
              <div className="space-y-2">
                <Label htmlFor="proposalItem">Select from Proposal (Optional)</Label>
                <select
                  id="proposalItem"
                  value={selectedProposalItemId}
                  onChange={(e) => {
                    const itemId = e.target.value
                    setSelectedProposalItemId(itemId)
                    if (itemId) {
                      const selectedItem = proposalItems.find(item => item.id === itemId)
                      if (selectedItem) {
                        setFormData({
                          ...formData,
                          description: selectedItem.description,
                          quantity: selectedItem.quantity || 1,
                          unitPrice: selectedItem.unitPrice || selectedItem.amount,
                          amount: selectedItem.amount,
                        })
                        setUseQuantityPrice(!!(selectedItem.quantity && selectedItem.unitPrice))
                      }
                    }
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">-- Select a proposal item --</option>
                  {proposalItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.description} - {formatCurrency(item.amount, currency)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Selecting an item will pre-fill the description and price from the proposal
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="chargeType">Charge Type *</Label>
              <select
                id="chargeType"
                value={formData.chargeType}
                onChange={(e) => setFormData({ ...formData, chargeType: e.target.value as "ONE_TIME" | "RECURRING" })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                required
              >
                <option value="ONE_TIME">One-Time</option>
                <option value="RECURRING">Recurring</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="useQuantityPrice"
                checked={useQuantityPrice}
                onChange={(e) => setUseQuantityPrice(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="useQuantityPrice">Use quantity × unit price</Label>
            </div>

            {useQuantityPrice ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.quantity || 1}
                    onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 1 })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unitPrice">Unit Price *</Label>
                  <Input
                    id="unitPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unitPrice || ""}
                    onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || undefined })}
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount || ""}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || undefined })}
                  required
                />
              </div>
            )}

            {formData.chargeType === "RECURRING" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="recurringFrequency">Recurring Frequency *</Label>
                  <select
                    id="recurringFrequency"
                    value={formData.recurringFrequency || ""}
                    onChange={(e) => setFormData({ ...formData, recurringFrequency: e.target.value as "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" || null })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    required
                  >
                    <option value="">Select frequency</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate || ""}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value || null })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date (Optional)</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate || ""}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value || null })}
                      min={formData.startDate || undefined}
                    />
                  </div>
                </div>
              </>
            )}

            {calculatedAmount > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm font-semibold text-blue-800">
                  Total Amount: {formatCurrency(calculatedAmount, currency)}
                  {formData.chargeType === "RECURRING" && formData.recurringFrequency && (
                    <span className="ml-2 text-xs">({formData.recurringFrequency.toLowerCase()})</span>
                  )}
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : charge ? "Update Charge" : "Add Charge"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

