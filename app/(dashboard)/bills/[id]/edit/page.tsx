"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

export default function EditBillPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState("")
  const [billId, setBillId] = useState<string>("")
  const [formData, setFormData] = useState({
    amount: "",
    dueDate: "",
  })

  useEffect(() => {
    params.then(({ id }) => {
      setBillId(id)
      fetch(`/api/bills/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setFormData({
          amount: data.amount?.toString() || "",
          dueDate: data.dueDate ? new Date(data.dueDate).toISOString().split("T")[0] : "",
        })
        setLoadingData(false)
      })
      .catch((err) => {
        setError("Failed to load bill data")
        setLoadingData(false)
      })
    })
  }, [params])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch(`/api/bills/${billId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(formData.amount),
          dueDate: formData.dueDate || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Failed to update bill")
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
      <h1 className="text-3xl font-bold mb-8">Edit Bill</h1>
      <Card>
        <CardHeader>
          <CardTitle>Bill Information</CardTitle>
          <CardDescription>Update the bill details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                {loading ? "Updating..." : "Update Bill"}
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

