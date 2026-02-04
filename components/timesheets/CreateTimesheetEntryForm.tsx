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
import { parseHoursInput, formatClientName } from "@/lib/utils"

interface User {
  id: string
  name: string
  email: string
  defaultHourlyRate?: number | null
  profile?: string | null
}

interface Project {
  id: string
  name: string
  clientId?: string | null
  proposal?: {
    id: string
    type: string
    blendedRate?: number | null
    useBlendedRate?: boolean | null
    hourlyRateRangeMin?: number | null
    hourlyRateRangeMax?: number | null
    hourlyRateTableRates?: any
    items?: Array<{
      id: string
      personId?: string | null
      rate?: number | null
      billingMethod?: string | null
    }>
  } | null
}

interface Client {
  id: string
  name: string
  clientCode?: number | null
  company?: string | null
}

interface CreateTimesheetEntryFormProps {
  projects: Project[]
  users: User[]
  clients: Client[]
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialProjectId?: string
  initialDescription?: string
  initialDate?: string
}

export function CreateTimesheetEntryForm({
  projects,
  users,
  clients,
  isOpen,
  onClose,
  onSuccess,
  initialProjectId,
  initialDescription,
  initialDate,
}: CreateTimesheetEntryFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoursInput, setHoursInput] = useState<string>("")
  const [hoursError, setHoursError] = useState<string | null>(null)
  
  // Helper to get today's date in YYYY-MM-DD format using local components
  const getTodayString = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [formData, setFormData] = useState({
    clientId: "",
    projectId: "",
    userId: "",
    date: getTodayString(),
    hours: 0,
    rate: "",
    description: "",
    billable: true,
  })

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      const initialProject = initialProjectId ? projects.find(p => p.id === initialProjectId) : null
      setFormData({
        clientId: initialProject?.clientId || "",
        projectId: initialProjectId || "",
        userId: "",
        date: initialDate || getTodayString(),
        hours: 0,
        rate: "",
        description: initialDescription || "",
        billable: true,
      })
      setHoursInput("")
      setHoursError(null)
      setError(null)
    }
  }, [isOpen, initialProjectId, initialDescription, initialDate, projects])

  // Filter projects based on selected client
  const filteredProjects = formData.clientId
    ? projects.filter((p) => p.clientId === formData.clientId)
    : projects

  // Helper function to determine rate from proposal
  const getProposalRate = (project: Project | undefined, userId: string | undefined): number | null => {
    if (!project || !project.proposal || !userId) {
      return null
    }

    const proposal = project.proposal
    const user = users.find((u) => u.id === userId)
    if (!user) {
      return null
    }

    // Priority 1: Blended rate if enabled
    if (proposal.useBlendedRate && proposal.blendedRate != null) {
      return proposal.blendedRate
    }

    // Priority 2: User-specific rate from proposal items
    if (proposal.items && Array.isArray(proposal.items)) {
      const userItem = proposal.items.find(
        (item) => item.personId === userId && item.rate != null && item.rate > 0
      )
      if (userItem) {
        return userItem.rate!
      }
    }

    // Priority 3: Hourly rate table rates (lookup by user profile or personId)
    if (proposal.hourlyRateTableRates && typeof proposal.hourlyRateTableRates === 'object') {
      const rateTable = proposal.hourlyRateTableRates as Record<string, any>
      
      // Try to find rate by user ID first
      if (rateTable[userId]) {
        const userRate = rateTable[userId]
        if (typeof userRate === 'number' && userRate > 0) {
          return userRate
        }
        if (typeof userRate === 'object' && userRate.rate && userRate.rate > 0) {
          return userRate.rate
        }
      }

      // Try to find rate by user profile
      if (user.profile && rateTable[user.profile]) {
        const profileRate = rateTable[user.profile]
        if (typeof profileRate === 'number' && profileRate > 0) {
          return profileRate
        }
        if (typeof profileRate === 'object' && profileRate.rate && profileRate.rate > 0) {
          return profileRate.rate
        }
      }
    }

    // Priority 4: Hourly rate range minimum
    if (proposal.hourlyRateRangeMin != null && proposal.hourlyRateRangeMin > 0) {
      return proposal.hourlyRateRangeMin
    }

    return null
  }

  // Clear project selection when client changes (if selected project doesn't belong to new client)
  useEffect(() => {
    if (formData.clientId && formData.projectId) {
      const selectedProject = projects.find((p) => p.id === formData.projectId)
      if (selectedProject && selectedProject.clientId !== formData.clientId) {
        setFormData((prev) => ({
          ...prev,
          projectId: "",
          rate: "",
        }))
      }
    }
  }, [formData.clientId, formData.projectId, projects])

  // Update rate when project or user changes
  useEffect(() => {
    if (formData.projectId && formData.userId) {
      const selectedProject = projects.find((p) => p.id === formData.projectId)
      const proposalRate = getProposalRate(selectedProject, formData.userId)
      
      if (proposalRate != null) {
        setFormData((prev) => ({
          ...prev,
          rate: proposalRate.toString(),
        }))
      } else {
        // Fall back to user's default rate
        const selectedUser = users.find((u) => u.id === formData.userId)
        if (selectedUser && selectedUser.defaultHourlyRate != null) {
          setFormData((prev) => ({
            ...prev,
            rate: selectedUser.defaultHourlyRate!.toString(),
          }))
        } else {
          // No rate available, clear it
          setFormData((prev) => ({
            ...prev,
            rate: "",
          }))
        }
      }
    } else if (formData.userId && !formData.projectId) {
      // Only user selected, use default rate
      const selectedUser = users.find((u) => u.id === formData.userId)
      if (selectedUser && selectedUser.defaultHourlyRate != null) {
        setFormData((prev) => ({
          ...prev,
          rate: selectedUser.defaultHourlyRate!.toString(),
        }))
      } else {
        setFormData((prev) => ({
          ...prev,
          rate: "",
        }))
      }
    } else if (!formData.userId && formData.projectId) {
      // Project selected but no user, clear rate
      setFormData((prev) => ({
        ...prev,
        rate: "",
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.projectId, formData.userId, projects, users])


  // Handle hours input change - support both "1:30" and "1,5" formats
  const handleHoursInputChange = (value: string) => {
    setHoursInput(value)
    setHoursError(null)
    
    if (!value || value.trim() === "") {
      setFormData(prev => ({ ...prev, hours: 0 }))
      return
    }

    const trimmed = value.trim()
    const hasColon = trimmed.includes(":")
    
    // If it has a colon but no minutes yet (e.g., "1:"), don't try to parse yet
    if (hasColon) {
      const parts = trimmed.split(":")
      if (parts.length === 2 && parts[1] === "") {
        return // User is still typing, don't parse yet
      }
    }

    try {
      const parsedHours = parseHoursInput(trimmed)
      setFormData(prev => ({ ...prev, hours: parsedHours }))
    } catch (err: any) {
      // Don't show error while typing - only on blur or submit
      setHoursError(null)
    }
  }

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

    // Validate and parse hours input
    let hours: number
    try {
      if (!hoursInput || hoursInput.trim() === "") {
        setHoursError("Please enter hours")
        setLoading(false)
        return
      }
      hours = parseHoursInput(hoursInput)
      if (hours <= 0) {
        setHoursError("Hours must be greater than 0")
        setLoading(false)
        return
      }
    } catch (err: any) {
      setHoursError(err.message || "Invalid hours format. Use decimal (1.5 or 1,5) or hours:minutes (1:30)")
      setLoading(false)
      return
    }

    // Ensure date is in YYYY-MM-DD format (string)
    const dateValue = formData.date.split('T')[0].split(' ')[0]

    try {
      const response = await fetch(`/api/projects/${formData.projectId}/timesheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: formData.userId,
          date: dateValue,
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

  const amount = formData.hours * (parseFloat(formData.rate) || 0)

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
              <Label htmlFor="clientId">Client</Label>
              <Select
                id="clientId"
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value, projectId: "" })}
                disabled={loading}
              >
                <option value="">All Clients</option>
                {Array.isArray(clients) && clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {formatClientName(client)} {client.company ? `(${client.company})` : ""}
                  </option>
                ))}
              </Select>
            </div>

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
                {Array.isArray(filteredProjects) && filteredProjects.map((project) => (
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
                {Array.isArray(users) && users.map((user) => (
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
                type="text"
                placeholder="1.5 or 1:30 or 1,5"
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
                disabled={loading}
              />
              {hoursError && (
                <p className="text-sm text-red-600">{hoursError}</p>
              )}
              {!hoursError && hoursInput && formData.hours > 0 && (
                <p className="text-sm text-gray-500">
                  {hoursInput.includes(":") 
                    ? `${formData.hours.toFixed(2)} hours` 
                    : formData.hours !== parseFloat(hoursInput.replace(',', '.')) 
                      ? `${formData.hours.toFixed(2)} hours (${Math.floor(formData.hours)}:${Math.round((formData.hours % 1) * 60).toString().padStart(2, "0")})`
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
                placeholder="Rate from proposal or user default"
                disabled={loading}
              />
              {formData.projectId && formData.userId && (
                <p className="text-xs text-gray-500">
                  {(() => {
                    const selectedProject = projects.find((p) => p.id === formData.projectId)
                    const proposalRate = getProposalRate(selectedProject, formData.userId)
                    const selectedUser = users.find((u) => u.id === formData.userId)
                    
                    if (proposalRate != null) {
                      return `Rate from proposal: ${proposalRate}`
                    } else if (selectedUser?.defaultHourlyRate != null) {
                      return `Using user's default rate: ${selectedUser.defaultHourlyRate}`
                    } else {
                      return "No rate set in proposal or user profile"
                    }
                  })()}
                </p>
              )}
              {formData.userId && !formData.projectId && (
                <p className="text-xs text-gray-500">
                  {users.find((u) => u.id === formData.userId)?.defaultHourlyRate
                    ? `User's default rate: ${users.find((u) => u.id === formData.userId)?.defaultHourlyRate}`
                    : "No default rate set for this user"}
                </p>
              )}
            </div>

            {formData.hours > 0 && parseFloat(formData.rate || "0") > 0 && (
              <div className="space-y-2">
                <Label>Amount</Label>
                <div className="text-lg font-semibold text-gray-700">
                  {(formData.hours * parseFloat(formData.rate || "0")).toFixed(2)} EUR
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
