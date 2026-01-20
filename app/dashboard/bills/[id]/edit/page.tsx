"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

export default function EditBillPage() {
  const router = useRouter()
  const params = useParams()
  const billId = params.id as string
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    subtotal: "",
    description: "",
    paymentDetailsId: "",
    taxInclusive: false,
    taxRate: "",
    discountPercent: "",
    discountAmount: "",
    dueDate: "",
  })
  const [calculatedAmount, setCalculatedAmount] = useState(0)
  const [paymentDetails, setPaymentDetails] = useState<Array<{ id: string; name: string; isDefault: boolean }>>([])

  useEffect(() => {
    if (!billId) return
    
    Promise.all([
      fetch(`/api/bills/${billId}`).then(res => res.json()),
      fetch("/api/payment-details").then(res => res.json()),
    ])
      .then(([billData, paymentDetailsData]) => {
        setFormData({
          subtotal: billData.subtotal?.toString() || billData.amount?.toString() || "",
          description: billData.description || "",
          paymentDetailsId: billData.paymentDetailsId || "",
          taxInclusive: billData.taxInclusive || false,
          taxRate: billData.taxRate?.toString() || "0",
          discountPercent: billData.discountPercent?.toString() || "",
          discountAmount: billData.discountAmount?.toString() || "",
          dueDate: billData.dueDate ? new Date(billData.dueDate).toISOString().split("T")[0] : "",
        })
        setCalculatedAmount(billData.amount || 0)
        setPaymentDetails(paymentDetailsData)
        setLoadingData(false)
      })
      .catch((err) => {
        setError("Failed to load invoice data")
        setLoadingData(false)
      })
  }, [billId])

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
      const response = await fetch(`/api/bills/${billId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtotal: parseFloat(formData.subtotal) || 0,
          description: formData.description || undefined,
          paymentDetailsId: formData.paymentDetailsId || null,
          taxInclusive: formData.taxInclusive,
          taxRate: formData.taxRate ? parseFloat(formData.taxRate) : null,
          discountPercent: formData.discountPercent ? parseFloat(formData.discountPercent) : null,
          discountAmount: formData.discountAmount ? parseFloat(formData.discountAmount) : null,
          dueDate: formData.dueDate || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Failed to update invoice")
      } else {
        router.push(`/dashboard/bills/${billId}`)
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return <div>Loading...</div>
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Edit Invoice</h1>
      <Card>
        <CardHeader>
          <CardTitle>Invoice Information</CardTitle>
          <CardDescription>Update the invoice details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="subtotal">Subtotal *</Label>
              <Input
                id="subtotal"
                type="number"
                step="0.01"
                min="0"
                value={formData.subtotal}
                onChange={(e) => setFormData({ ...formData, subtotal: e.target.value })}
                required
              />
              <p className="text-xs text-gray-500">Total of all line items before discount and tax</p>
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

            <div className="space-y-2">
              <Label htmlFor="paymentDetailsId">Payment Details</Label>
              <Select
                id="paymentDetailsId"
                value={formData.paymentDetailsId}
                onChange={(e) => setFormData({ ...formData, paymentDetailsId: e.target.value })}
              >
                <option value="">No payment details</option>
                {paymentDetails.map((pd) => (
                  <option key={pd.id} value={pd.id}>
                    {pd.name} {pd.isDefault ? "(Default)" : ""}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-gray-500">Select payment details to display at the bottom of the invoice PDF</p>
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
                  <input
                    type="checkbox"
                    id="taxInclusive"
                    checked={formData.taxInclusive}
                    onChange={(e) => setFormData({ ...formData, taxInclusive: e.target.checked })}
                    className="rounded"
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
                {loading ? "Updating..." : "Update Invoice"}
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

