"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Plus, Edit, Trash2, Check, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface PaymentDetails {
  id: string
  name: string
  details: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export function PaymentDetailsClient() {
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    details: "",
    isDefault: false,
  })

  useEffect(() => {
    fetchPaymentDetails()
  }, [])

  const fetchPaymentDetails = async () => {
    try {
      const response = await fetch("/api/payment-details")
      if (response.ok) {
        const data = await response.json()
        setPaymentDetails(data)
      } else {
        setError("Failed to load payment details")
      }
    } catch (err) {
      setError("Failed to load payment details")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    try {
      const url = editingId 
        ? `/api/payment-details/${editingId}`
        : "/api/payment-details"
      const method = editingId ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Failed to save payment details")
        return
      }

      setSuccess(editingId ? "Payment details updated successfully" : "Payment details created successfully")
      setShowForm(false)
      setEditingId(null)
      setFormData({ name: "", details: "", isDefault: false })
      fetchPaymentDetails()
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      setError("An error occurred. Please try again.")
    }
  }

  const handleEdit = (pd: PaymentDetails) => {
    setFormData({
      name: pd.name,
      details: pd.details,
      isDefault: pd.isDefault,
    })
    setEditingId(pd.id)
    setShowForm(true)
    setError("")
    setSuccess("")
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this payment details? This action cannot be undone.")) {
      return
    }

    try {
      const response = await fetch(`/api/payment-details/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Failed to delete payment details")
        return
      }

      setSuccess("Payment details deleted successfully")
      fetchPaymentDetails()
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      setError("An error occurred. Please try again.")
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({ name: "", details: "", isDefault: false })
    setError("")
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Payment Details</h1>
        <p className="text-gray-600">
          Manage payment details templates that can be used in invoices. These will appear at the bottom of invoice PDFs.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <div className="mb-6">
        {!showForm ? (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Payment Details
          </Button>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? "Edit Payment Details" : "Add Payment Details"}</CardTitle>
              <CardDescription>
                Create a payment details template that can be selected when creating invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Main Bank Account, PayPal, Wire Transfer"
                    required
                  />
                  <p className="text-xs text-gray-500">A descriptive name for this payment method</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="details">Payment Details *</Label>
                  <Textarea
                    id="details"
                    value={formData.details}
                    onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                    rows={6}
                    placeholder="Enter payment instructions, bank account details, IBAN, SWIFT code, etc."
                    required
                  />
                  <p className="text-xs text-gray-500">This text will appear at the bottom of invoices</p>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="isDefault" className="cursor-pointer">
                    Set as default (will be pre-selected when creating new invoices)
                  </Label>
                </div>

                <div className="flex space-x-2">
                  <Button type="submit">
                    {editingId ? "Update" : "Create"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        {paymentDetails.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              No payment details created yet. Click "Add Payment Details" to get started.
            </CardContent>
          </Card>
        ) : (
          paymentDetails.map((pd) => (
            <Card key={pd.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-semibold">{pd.name}</h3>
                      {pd.isDefault && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded border">
                      {pd.details}
                    </div>
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(pd)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(pd.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}


