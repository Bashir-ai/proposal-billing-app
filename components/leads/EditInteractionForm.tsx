"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { InteractionType } from "@prisma/client"
import { X } from "lucide-react"
import { Select } from "@/components/ui/select"
import { formatDateForInput } from "@/lib/utils"

interface LeadInteraction {
  id: string
  interactionType: InteractionType
  notes: string | null
  date: string
  createdAt: string
  creator: {
    id: string
    name: string
    email: string
  }
}

interface EditInteractionFormProps {
  leadId: string
  interaction: LeadInteraction
  onSuccess: () => void
  onCancel: () => void
}

export function EditInteractionForm({
  leadId,
  interaction,
  onSuccess,
  onCancel,
}: EditInteractionFormProps) {
  const [notes, setNotes] = useState(interaction.notes || "")
  const [date, setDate] = useState(() => {
    // Convert date to YYYY-MM-DD format using formatDateForInput to avoid timezone issues
    return formatDateForInput(new Date(interaction.date))
  })
  const [interactionType, setInteractionType] = useState<InteractionType>(interaction.interactionType)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch(`/api/leads/${leadId}/interactions/${interaction.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interactionType,
          notes: notes || null,
          date: date,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update interaction")
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="mb-4 border-blue-200">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Edit Interaction</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interactionType">Interaction Type</Label>
            <Select
              id="interactionType"
              value={interactionType}
              onChange={(e) => setInteractionType(e.target.value as InteractionType)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {Object.values(InteractionType).map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </div>

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
              placeholder="Add any additional notes about this interaction..."
            />
          </div>

          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}

          <div className="flex space-x-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
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
