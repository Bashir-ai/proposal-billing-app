"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { parseHoursInput } from "@/lib/utils"

interface User {
  id: string
  name: string
  email: string
  defaultHourlyRate?: number | null
}

export default function NewTimesheetEntryPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [formData, setFormData] = useState({
    userId: "",
    date: new Date().toISOString().split("T")[0],
    hours: "",
    rate: "",
    description: "",
    billable: true,
  })
  const [hoursInput, setHoursInput] = useState("")
  const [hoursError, setHoursError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch users for dropdown
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        const staffUsers = data.filter((u: any) => u.role !== "CLIENT")
        setUsers(staffUsers)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Failed to fetch users:", err)
        setError("Failed to load users")
        setLoading(false)
      })
  }, [])

  // Update rate when user is selected
  useEffect(() => {
    if (formData.userId) {
      const selectedUser = users.find((u) => u.id === formData.userId)
      if (selectedUser && selectedUser.defaultHourlyRate != null) {
        const hourlyRate = selectedUser.defaultHourlyRate
        setFormData((prev) => ({
          ...prev,
          rate: hourlyRate.toString(),
        }))
      }
    }
  }, [formData.userId, users])

  const handleHoursInputChange = (value: string) => {
    setHoursInput(value)
    setHoursError(null)
    
    if (!value || value.trim() === "") {
      return
    }

    try {
      const parsedHours = parseHoursInput(value)
      setFormData(prev => ({ ...prev, hours: parsedHours.toString() }))
    } catch (err: any) {
      setHoursError(err.message)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setHoursError(null)
    setSubmitting(true)

    // Validate hours input
    let hours: number
    try {
      if (!hoursInput || hoursInput.trim() === "") {
        setError("Please enter hours")
        setSubmitting(false)
        return
      }
      hours = parseHoursInput(hoursInput)
      if (hours <= 0) {
        setHoursError("Hours must be greater than 0")
        setSubmitting(false)
        return
      }
    } catch (err: any) {
      setHoursError(err.message || "Invalid hours format")
      setSubmitting(false)
      return
    }

    if (!formData.userId) {
      setError("Please select a user")
      setSubmitting(false)
      return
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/timesheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: formData.userId,
          date: formData.date,
          hours: hours,
          rate: formData.rate ? parseFloat(formData.rate) : null,
          description: formData.description || null,
          billable: formData.billable,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create timesheet entry")
      }

      router.push(`/dashboard/projects/${projectId}`)
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Add Timesheet Entry</h1>
      <Card>
        <CardHeader>
          <CardTitle>New Timesheet Entry</CardTitle>
          <CardDescription>Record time worked on this project</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userId">User *</Label>
              <Select
                id="userId"
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                required
              >
                <option value="">Select a user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} {user.email ? `(${user.email})` : ""}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
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
                required
              />
              {hoursError && (
                <p className="text-sm text-red-600">{hoursError}</p>
              )}
              {!hoursError && hoursInput && formData.hours && parseFloat(formData.hours) > 0 && (
                <p className="text-sm text-gray-500">
                  {hoursInput.includes(":") 
                    ? `${parseFloat(formData.hours).toFixed(2)} hours` 
                    : parseFloat(formData.hours) !== parseFloat(hoursInput) 
                      ? `${parseFloat(formData.hours).toFixed(2)} hours (${Math.floor(parseFloat(formData.hours))}:${Math.round((parseFloat(formData.hours) % 1) * 60).toString().padStart(2, "0")})`
                      : ""}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate">Rate (per hour)</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                min="0"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                placeholder="Will use user's default rate if not provided"
              />
              {formData.userId && (
                <p className="text-xs text-gray-500">
                  {users.find((u) => u.id === formData.userId)?.defaultHourlyRate
                    ? `User's default rate: ${users.find((u) => u.id === formData.userId)?.defaultHourlyRate}`
                    : "No default rate set for this user"}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="What work was performed..."
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="billable"
                checked={formData.billable}
                onCheckedChange={(checked) => setFormData({ ...formData, billable: !!checked })}
              />
              <Label htmlFor="billable" className="cursor-pointer">
                Billable (will be included in invoices)
              </Label>
            </div>

            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}

            <div className="flex space-x-4">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create Timesheet Entry"}
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


