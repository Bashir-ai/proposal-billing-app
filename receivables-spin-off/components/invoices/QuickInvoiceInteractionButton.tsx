"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { InteractionType } from "@prisma/client"
import { X } from "lucide-react"
import { toast } from "sonner"

interface QuickInvoiceInteractionButtonProps {
  billId: string
  interactionType: InteractionType
  label: string
  onInteractionCreated: () => void
}

export function QuickInvoiceInteractionButton({
  billId,
  interactionType,
  label,
  onInteractionCreated,
}: QuickInvoiceInteractionButtonProps) {
  const [showForm, setShowForm] = useState(false)
  const [notes, setNotes] = useState("")
  const [paymentRemarks, setPaymentRemarks] = useState("")
  const [extensionDate, setExtensionDate] = useState("")
  const [grantExtension, setGrantExtension] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Validate extension date if granting extension
    if (grantExtension && extensionDate) {
      const extDate = new Date(extensionDate)
      if (extDate <= new Date()) {
        setError("Extension date must be in the future")
        return
      }
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/bills/${billId}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interactionType,
          notes: notes || null,
          paymentRemarks: paymentRemarks || null,
          extensionDate: grantExtension && extensionDate ? extensionDate : null,
          date: date || new Date().toISOString().split("T")[0],
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create interaction")
      }

      toast.success("Follow-up recorded successfully")
      setShowForm(false)
      setNotes("")
      setPaymentRemarks("")
      setExtensionDate("")
      setGrantExtension(false)
      setDate(new Date().toISOString().split("T")[0])
      onInteractionCreated()
    } catch (err: any) {
      setError(err.message || "An error occurred")
      toast.error(err.message || "Failed to record follow-up")
    } finally {
      setLoading(false)
    }
  }

  if (showForm) {
    return (
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Log {label}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false)
                setError("")
              }}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add any additional notes about this follow-up..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentRemarks">Payment Remarks (Optional)</Label>
              <Textarea
                id="paymentRemarks"
                value={paymentRemarks}
                onChange={(e) => setPaymentRemarks(e.target.value)}
                rows={3}
                placeholder="What did the client say about payment? Any payment commitments or concerns?"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="grantExtension"
                checked={grantExtension}
                onCheckedChange={(checked) => setGrantExtension(checked as boolean)}
              />
              <Label htmlFor="grantExtension" className="cursor-pointer">
                Grant extension
              </Label>
            </div>

            {grantExtension && (
              <div className="space-y-2">
                <Label htmlFor="extensionDate">New Due Date</Label>
                <Input
                  id="extensionDate"
                  type="date"
                  value={extensionDate}
                  onChange={(e) => setExtensionDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  required={grantExtension}
                />
              </div>
            )}

            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}

            <div className="flex space-x-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Follow-up"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false)
                  setError("")
                }}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    )
  }

  return (
    <Button
      variant="outline"
      onClick={() => setShowForm(true)}
      className="w-full"
    >
      {label}
    </Button>
  )
}
