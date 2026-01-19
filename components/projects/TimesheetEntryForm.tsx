"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { X } from "lucide-react"
import { parseHoursInput } from "@/lib/utils"

interface User {
  id: string
  name: string
  email: string
  defaultHourlyRate?: number | null
}

interface TimesheetEntry {
  id?: string
  userId: string
  date: string | Date
  hours: number
  rate: number | null
  description?: string | null
  billable: boolean
}

interface ProposalData {
  id: string
  useBlendedRate: boolean
  blendedRate: number | null
  items: Array<{
    id: string
    personId?: string | null
    rate?: number | null
  }>
}

interface TimesheetEntryFormProps {
  projectId: string
  entry?: TimesheetEntry | null
  users: User[]
  proposal?: ProposalData | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function TimesheetEntryForm({
  projectId,
  entry,
  users,
  proposal,
  isOpen,
  onClose,
  onSuccess,
}: TimesheetEntryFormProps) {
  const [usersWithRates, setUsersWithRates] = useState<User[]>(users)
  const [formData, setFormData] = useState<TimesheetEntry>({
    userId: entry?.userId || users[0]?.id || "",
    date: entry?.date || new Date().toISOString().split("T")[0],
    hours: entry?.hours || 0,
    rate: entry?.rate || 0,
    description: entry?.description || "",
    billable: entry?.billable ?? true,
  })
  const [hoursInput, setHoursInput] = useState<string>(entry?.hours?.toString() || "0")
  const [hoursError, setHoursError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch users with default rates
  useEffect(() => {
    if (users.length > 0 && !users[0].defaultHourlyRate) {
      fetch("/api/users")
        .then((res) => res.json())
        .then((data) => {
          const staffUsers = data.filter((user: any) => user.role !== "CLIENT")
          setUsersWithRates(staffUsers)
        })
        .catch(console.error)
    } else {
      setUsersWithRates(users)
    }
  }, [users])

  // Calculate default rate based on proposal
  const getDefaultRate = (userId: string): number => {
    const user = usersWithRates.find(u => u.id === userId)
    
    // If proposal uses blended rate, use that
    if (proposal?.useBlendedRate && proposal.blendedRate) {
      return proposal.blendedRate
    }
    
    // If proposal has a line item for this person, use that rate
    if (proposal?.items) {
      const personItem = proposal.items.find(item => item.personId === userId)
      if (personItem?.rate) {
        return personItem.rate
      }
    }
    
    // Otherwise, use user's default rate
    if (user?.defaultHourlyRate) {
      return user.defaultHourlyRate
    }
    
    return 0
  }

  useEffect(() => {
    if (entry) {
      setFormData({
        userId: entry.userId,
        date: entry.date,
        hours: entry.hours,
        rate: entry.rate,
        description: entry.description || "",
        billable: entry.billable,
      })
      setHoursInput(entry.hours.toString())
    } else {
      const defaultUserId = usersWithRates[0]?.id || ""
      if (defaultUserId) {
        const user = usersWithRates.find(u => u.id === defaultUserId)
        let defaultRate = 0
        
        // If proposal uses blended rate, use that
        if (proposal?.useBlendedRate && proposal.blendedRate) {
          defaultRate = proposal.blendedRate
        } else if (proposal?.items) {
          // If proposal has a line item for this person, use that rate
          const personItem = proposal.items.find(item => item.personId === defaultUserId)
          if (personItem?.rate) {
            defaultRate = personItem.rate
          } else if (user?.defaultHourlyRate) {
            defaultRate = user.defaultHourlyRate
          }
        } else if (user?.defaultHourlyRate) {
          defaultRate = user.defaultHourlyRate
        }
        
        setFormData({
          userId: defaultUserId,
          date: new Date().toISOString().split("T")[0],
          hours: 0,
          rate: defaultRate,
          description: "",
          billable: true,
        })
        setHoursInput("0")
      }
    }
  }, [entry, usersWithRates, proposal])

  // Update rate when user changes
  const handleUserIdChange = (userId: string) => {
    const defaultRate = getDefaultRate(userId)
    setFormData(prev => ({
      ...prev,
      userId,
      rate: defaultRate,
    }))
  }

  const handleHoursInputChange = (value: string) => {
    // Allow any input including colons - don't restrict typing
    setHoursInput(value)
    setHoursError(null)
    
    if (!value || value.trim() === "") {
      setFormData(prev => ({ ...prev, hours: 0 }))
      return
    }

    // Only try to parse if the input looks complete (has minutes after colon or is a complete decimal)
    const trimmed = value.trim()
    const hasColon = trimmed.includes(":")
    
    // If it has a colon but no minutes yet (e.g., "1:"), don't try to parse yet
    if (hasColon) {
      const parts = trimmed.split(":")
      if (parts.length === 2 && parts[1] === "") {
        // User is still typing, don't parse yet
        return
      }
    }

    try {
      const parsedHours = parseHoursInput(value)
      setFormData(prev => ({ ...prev, hours: parsedHours }))
    } catch (err: any) {
      // Don't show error while user is typing - only on blur or submit
      setHoursError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setHoursError(null)

    // Validate hours input before submitting
    try {
      const parsedHours = parseHoursInput(hoursInput)
      if (parsedHours <= 0) {
        setHoursError("Hours must be greater than 0")
        setLoading(false)
        return
      }
      
      // Update formData with parsed hours
      const submitData = { ...formData, hours: parsedHours }
      
      const url = entry?.id
        ? `/api/projects/${projectId}/timesheet/${entry.id}`
        : `/api/projects/${projectId}/timesheet`
      
      const method = entry?.id ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save timesheet entry")
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      if (err.message.includes("Invalid hours format") || err.message.includes("Minutes must be")) {
        setHoursError(err.message)
      } else {
        setError(err.message || "An error occurred. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  const amount = formData.hours * (formData.rate ?? 0)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{entry ? "Edit Timesheet Entry" : "Add Timesheet Entry"}</CardTitle>
              <CardDescription>Record hours worked on this project</CardDescription>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="userId">Person *</Label>
                <select
                  id="userId"
                  value={formData.userId}
                  onChange={(e) => handleUserIdChange(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                >
                  <option value="">Select a person</option>
                  {usersWithRates.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date instanceof Date ? formData.date.toISOString().split('T')[0] : formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hours">Hours *</Label>
                <Input
                  id="hours"
                  type="text"
                  placeholder="1.5 or 1:30"
                  value={hoursInput}
                  onChange={(e) => handleHoursInputChange(e.target.value)}
                  onBlur={() => {
                    // Validate on blur
                    if (hoursInput && hoursInput.trim() !== "") {
                      try {
                        const parsed = parseHoursInput(hoursInput)
                        if (parsed <= 0) {
                          setHoursError("Hours must be greater than 0")
                        }
                      } catch (err: any) {
                        setHoursError(err.message)
                      }
                    }
                  }}
                  required
                />
                {hoursError && (
                  <p className="text-sm text-red-600">{hoursError}</p>
                )}
                {!hoursError && hoursInput && formData.hours > 0 && (
                  <p className="text-sm text-gray-500">
                    {hoursInput.includes(":") 
                      ? `${formData.hours.toFixed(2)} hours` 
                      : formData.hours !== parseFloat(hoursInput) 
                        ? `${formData.hours.toFixed(2)} hours (${Math.floor(formData.hours)}:${Math.round((formData.hours % 1) * 60).toString().padStart(2, "0")})`
                        : ""}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rate">Rate (per hour) *</Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.rate ?? 0}
                  onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="billable"
                checked={formData.billable}
                onChange={(e) => setFormData({ ...formData, billable: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="billable">Billable</Label>
            </div>

            {amount > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm font-semibold text-blue-800">
                  Total Amount: €{amount.toFixed(2)}
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : entry ? "Update Entry" : "Add Entry"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

