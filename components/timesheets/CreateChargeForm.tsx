"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { ChargeType, RecurringFrequency } from "@prisma/client"

interface Project {
  id: string
  name: string
}

interface CreateChargeFormProps {
  projects: Project[]
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  currency?: string
}

export function CreateChargeForm({
  projects,
  isOpen,
  onClose,
  onSuccess,
  currency = "EUR",
}: CreateChargeFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useQuantityPrice, setUseQuantityPrice] = useState(false)
  const [formData, setFormData] = useState({
    projectId: "",
    description: "",
    amount: "",
    quantity: "1",
    unitPrice: "",
    chargeType: "ONE_TIME" as ChargeType,
    recurringFrequency: null as RecurringFrequency | null,
    startDate: "",
    endDate: "",
  })

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        projectId: "",
        description: "",
        amount: "",
        quantity: "1",
        unitPrice: "",
        chargeType: "ONE_TIME",
        recurringFrequency: null,
        startDate: "",
        endDate: "",
      })
      setUseQuantityPrice(false)
      setError(null)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Validation
    if (!formData.projectId) {
      setError("Please select a project")
      setLoading(false)
      return
    }

    if (!formData.description.trim()) {
      setError("Description is required")
      setLoading(false)
      return
    }

    try {
      // Calculate amount if using quantity × unitPrice
      let finalAmount: number | undefined
      if (useQuantityPrice && formData.quantity && formData.unitPrice) {
        finalAmount = parseFloat(formData.quantity) * parseFloat(formData.unitPrice)
      } else if (formData.amount) {
        finalAmount = parseFloat(formData.amount)
      }

      if (!finalAmount || finalAmount <= 0) {
        setError("Amount is required and must be greater than 0")
        setLoading(false)
        return
      }

      const payload: any = {
        description: formData.description,
        chargeType: formData.chargeType,
      }

      if (useQuantityPrice) {
        payload.quantity = parseFloat(formData.quantity)
        payload.unitPrice = parseFloat(formData.unitPrice)
      } else {
        payload.amount = finalAmount
      }

      if (formData.chargeType === "RECURRING") {
        if (!formData.recurringFrequency) {
          setError("Recurring frequency is required for recurring charges")
          setLoading(false)
          return
        }
        if (!formData.startDate) {
          setError("Start date is required for recurring charges")
          setLoading(false)
          return
        }
        payload.recurringFrequency = formData.recurringFrequency
        payload.startDate = formData.startDate
        if (formData.endDate) {
          payload.endDate = formData.endDate
        }
      }

      const response = await fetch(`/api/projects/${formData.projectId}/charges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create charge")
      }

      toast.success("Charge created successfully")
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.")
      toast.error(err.message || "Failed to create charge")
    } finally {
      setLoading(false)
    }
  }

  const calculatedAmount = useQuantityPrice && formData.quantity && formData.unitPrice
    ? parseFloat(formData.quantity) * parseFloat(formData.unitPrice)
    : formData.amount ? parseFloat(formData.amount) : 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Charge</DialogTitle>
          <DialogDescription>Add a service or charge to a project</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="projectId">Project *</Label>
            <Select
              id="projectId"
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              required
              disabled={loading}
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              disabled={loading}
              placeholder="Service or charge description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="chargeType">Charge Type *</Label>
            <Select
              id="chargeType"
              value={formData.chargeType}
              onChange={(e) => setFormData({ ...formData, chargeType: e.target.value as ChargeType })}
              required
              disabled={loading}
            >
              <option value="ONE_TIME">One Time</option>
              <option value="RECURRING">Recurring</option>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="useQuantityPrice"
              checked={useQuantityPrice}
              onChange={(e) => setUseQuantityPrice(e.target.checked)}
              className="rounded"
              disabled={loading}
            />
            <Label htmlFor="useQuantityPrice" className="cursor-pointer">
              Use Quantity × Unit Price
            </Label>
          </div>

          {useQuantityPrice ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitPrice">Unit Price ({currency}) *</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ({currency}) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                disabled={loading}
              />
            </div>
          )}

          {calculatedAmount > 0 && (
            <div className="space-y-2">
              <Label>Total Amount</Label>
              <div className="text-lg font-semibold text-gray-700">
                {formatCurrency(calculatedAmount, currency)}
              </div>
            </div>
          )}

          {formData.chargeType === "RECURRING" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="recurringFrequency">Recurring Frequency *</Label>
                <Select
                  id="recurringFrequency"
                  value={formData.recurringFrequency || ""}
                  onChange={(e) => setFormData({ ...formData, recurringFrequency: e.target.value as RecurringFrequency })}
                  required
                  disabled={loading}
                >
                  <option value="">Select frequency</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="YEARLY">Yearly</option>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date (Optional)</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    disabled={loading}
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex space-x-4 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Charge"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
