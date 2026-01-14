"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"

interface User {
  id: string
  name: string
  email: string
  defaultHourlyRate?: number | null
}

interface Project {
  id: string
  name: string
}

interface CreateTimesheetEntryFormProps {
  projects: Project[]
  users: User[]
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateTimesheetEntryForm({
  projects,
  users,
  isOpen,
  onClose,
  onSuccess,
}: CreateTimesheetEntryFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    projectId: "",
    userId: "",
    date: new Date().toISOString().split("T")[0],
    hours: "",
    rate: "",
    description: "",
    billable: true,
  })

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        projectId: "",
        userId: "",
        date: new Date().toISOString().split("T")[0],
        hours: "",
        rate: "",
        description: "",
        billable: true,
      })
      setError(null)
    }
  }, [isOpen])

  // Update rate when user is selected
  useEffect(() => {
    if (formData.userId) {
      const selectedUser = users.find((u) => u.id === formData.userId)
      if (selectedUser && selectedUser.defaultHourlyRate != null) {
        setFormData((prev) => ({
          ...prev,
          rate: selectedUser.defaultHourlyRate.toString(),
        }))
      }
    }
  }, [formData.userId, users])

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

    if (!formData.userId) {
      setError("Please select a user")
      setLoading(false)
      return
    }

    const hours = parseFloat(formData.hours)
    if (isNaN(hours) || hours <= 0) {
      setError("Please enter a valid number of hours greater than 0")
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`/api/projects/${formData.projectId}/timesheet`, {
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

      toast.success("Timesheet entry created successfully")
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.")
      toast.error(err.message || "Failed to create timesheet entry")
    } finally {
      setLoading(false)
    }
  }

  const amount = parseFloat(formData.hours) * (parseFloat(formData.rate) || 0)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Timesheet Entry</DialogTitle>
          <DialogDescription>Record time worked on a project</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Label htmlFor="userId">User *</Label>
              <Select
                id="userId"
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                required
                disabled={loading}
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
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hours">Hours *</Label>
              <Input
                id="hours"
                type="number"
                step="0.25"
                min="0.25"
                value={formData.hours}
                onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                required
                disabled={loading}
              />
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
                disabled={loading}
              />
              {formData.userId && (
                <p className="text-xs text-gray-500">
                  {users.find((u) => u.id === formData.userId)?.defaultHourlyRate
                    ? `User's default rate: ${users.find((u) => u.id === formData.userId)?.defaultHourlyRate}`
                    : "No default rate set for this user"}
                </p>
              )}
            </div>

            {amount > 0 && (
              <div className="space-y-2">
                <Label>Amount</Label>
                <div className="text-lg font-semibold text-gray-700">
                  {amount.toFixed(2)} EUR
                </div>
              </div>
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
              disabled={loading}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="billable"
              checked={formData.billable}
              onCheckedChange={(checked) => setFormData({ ...formData, billable: !!checked })}
              disabled={loading}
            />
            <Label htmlFor="billable" className="cursor-pointer">
              Billable (will be included in invoices)
            </Label>
          </div>

          <div className="flex space-x-4 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Timesheet Entry"}
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
