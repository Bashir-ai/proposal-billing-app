"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { X } from "lucide-react"
import { parseHoursInput, formatCurrency } from "@/lib/utils"

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

interface LeadTimesheetEntryFormProps {
  leadId: string
  entry?: TimesheetEntry | null
  users: User[]
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function LeadTimesheetEntryForm({
  leadId,
  entry,
  users,
  isOpen,
  onClose,
  onSuccess,
}: LeadTimesheetEntryFormProps) {
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

  // Helper function to format date for date input (YYYY-MM-DD)
  const formatDateForInput = (date: Date | string | null): string => {
    if (!date) return new Date().toISOString().split('T')[0]
    
    if (date instanceof Date) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    if (typeof date === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date
      }
      const datePart = date.split('T')[0]
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        return datePart
      }
      const d = new Date(date)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    return new Date().toISOString().split('T')[0]
  }

  useEffect(() => {
    if (entry) {
      let dateValue: string
      if (entry.date instanceof Date) {
        const year = entry.date.getFullYear()
        const month = String(entry.date.getMonth() + 1).padStart(2, '0')
        const day = String(entry.date.getDate()).padStart(2, '0')
        dateValue = `${year}-${month}-${day}`
      } else if (typeof entry.date === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
          dateValue = entry.date
        } else {
          const d = new Date(entry.date)
          const year = d.getFullYear()
          const month = String(d.getMonth() + 1).padStart(2, '0')
          const day = String(d.getDate()).padStart(2, '0')
          dateValue = `${year}-${month}-${day}`
        }
      } else {
        dateValue = formatDateForInput(entry.date)
      }
      
      setFormData({
        userId: entry.userId,
        date: dateValue,
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
        const defaultRate = user?.defaultHourlyRate || 0
        
        const today = new Date()
        const year = today.getFullYear()
        const month = String(today.getMonth() + 1).padStart(2, '0')
        const day = String(today.getDate()).padStart(2, '0')
        const todayString = `${year}-${month}-${day}`
        
        setFormData({
          userId: defaultUserId,
          date: todayString,
          hours: 0,
          rate: defaultRate,
          description: "",
          billable: true,
        })
        setHoursInput("0")
      }
    }
  }, [entry, usersWithRates])

  // Update rate when user changes
  const handleUserIdChange = (userId: string) => {
    const user = usersWithRates.find(u => u.id === userId)
    const defaultRate = user?.defaultHourlyRate || 0
    setFormData(prev => ({
      ...prev,
      userId,
      rate: defaultRate,
    }))
  }

  const handleHoursInputChange = (value: string) => {
    setHoursInput(value)
    setHoursError(null)
    
    if (!value || value.trim() === "") {
      setFormData(prev => ({ ...prev, hours: 0 }))
      return
    }

    const trimmed = value.trim()
    
    if (trimmed.includes(":")) {
      const parts = trimmed.split(":")
      if (parts.length === 2 && parts[1] === "") {
        return
      }
      if (parts.length === 2 && parts[1] !== "") {
        try {
          const parsedHours = parseHoursInput(trimmed)
          setFormData(prev => ({ ...prev, hours: parsedHours }))
        } catch (err: any) {
          setHoursError(null)
        }
        return
      }
    }

    try {
      const parsedHours = parseHoursInput(trimmed)
      setFormData(prev => ({ ...prev, hours: parsedHours }))
    } catch (err: any) {
      setHoursError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setHoursError(null)

    try {
      const parsedHours = parseHoursInput(hoursInput)
      if (parsedHours <= 0) {
        setHoursError("Hours must be greater than 0")
        setLoading(false)
        return
      }
      
      let dateValue: string
      if (typeof formData.date === 'string') {
        dateValue = formData.date.split('T')[0].split(' ')[0]
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
          const d = new Date(formData.date)
          const year = d.getFullYear()
          const month = String(d.getMonth() + 1).padStart(2, '0')
          const day = String(d.getDate()).padStart(2, '0')
          dateValue = `${year}-${month}-${day}`
        }
      } else {
        const d = formData.date instanceof Date ? formData.date : new Date(formData.date)
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        dateValue = `${year}-${month}-${day}`
      }
      
      const submitData = { 
        ...formData, 
        hours: parsedHours,
        date: dateValue
      }
      
      const url = entry?.id
        ? `/api/leads/${leadId}/timesheet/${entry.id}`
        : `/api/leads/${leadId}/timesheet`
      
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
              <CardDescription>Record hours worked for this lead</CardDescription>
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
                  value={typeof formData.date === 'string' ? formData.date : formatDateForInput(formData.date)}
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
                  Total Amount: {formatCurrency(amount)}
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
