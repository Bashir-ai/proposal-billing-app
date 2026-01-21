"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface TimesheetTimelineFiltersProps {
  users: Array<{ id: string; name: string }>
  projects?: Array<{ id: string; name: string; clientId?: string }>
  clients?: Array<{ id: string; name: string; company?: string | null }>
  onFilterChange: (filters: TimesheetTimelineFilters) => void
  currentUserId: string
  userRole: string
  initialFilters?: TimesheetTimelineFilters
}

export interface TimesheetTimelineFilters {
  userId?: string
  clientId?: string
  projectId?: string
  startDate?: string
  endDate?: string
  billed?: string
  type?: string
}

export function TimesheetTimelineFilters({
  users,
  projects = [],
  clients = [],
  onFilterChange,
  currentUserId,
  userRole,
  initialFilters,
}: TimesheetTimelineFiltersProps) {
  const [localFilters, setLocalFilters] = useState<TimesheetTimelineFilters>(initialFilters || {
    userId: userRole === "STAFF" ? currentUserId : undefined,
  })

  useEffect(() => {
    if (initialFilters) {
      setLocalFilters(initialFilters)
    }
  }, [initialFilters])

  // Filter projects based on selected client
  const filteredProjects = localFilters.clientId
    ? projects.filter((p) => p.clientId === localFilters.clientId)
    : projects

  // Clear projectId if selected project doesn't belong to selected client
  useEffect(() => {
    if (localFilters.clientId && localFilters.projectId && projects.length > 0) {
      const selectedProject = projects.find((p) => p.id === localFilters.projectId)
      if (selectedProject && selectedProject.clientId !== localFilters.clientId) {
        const newFilters = {
          ...localFilters,
          projectId: undefined,
        }
        setLocalFilters(newFilters)
        onFilterChange(newFilters)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localFilters.clientId, localFilters.projectId])

  const handleFilterChange = (key: keyof TimesheetTimelineFilters, value: string | undefined) => {
    const newFilters = {
      ...localFilters,
      [key]: value === "" ? undefined : value,
    }
    setLocalFilters(newFilters)
    // Apply filters immediately
    onFilterChange(newFilters)
  }

  const clearFilters = () => {
    const cleared = {
      userId: userRole === "STAFF" ? currentUserId : undefined,
    }
    setLocalFilters(cleared)
    onFilterChange(cleared)
  }

  const hasActiveFilters = Object.entries(localFilters).some(([key, value]) => {
    if (key === "userId") {
      const defaultUserId = userRole === "STAFF" ? currentUserId : undefined
      return value !== defaultUserId && value !== undefined
    }
    return value !== undefined && value !== ""
  })

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Timeline Filters</h3>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="text-xs h-7"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {(userRole === "ADMIN" || userRole === "MANAGER") && (
            <div className="space-y-1">
              <Label htmlFor="timeline-user" className="text-xs">User</Label>
              <Select
                id="timeline-user"
                value={localFilters.userId || ""}
                onChange={(e) => handleFilterChange("userId", e.target.value)}
              >
                <option value="">All Users</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {clients.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="timeline-client" className="text-xs">Client</Label>
              <Select
                id="timeline-client"
                value={localFilters.clientId || ""}
                onChange={(e) => handleFilterChange("clientId", e.target.value)}
              >
                <option value="">All Clients</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} {client.company ? `(${client.company})` : ""}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {filteredProjects.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="timeline-project" className="text-xs">Project</Label>
              <Select
                id="timeline-project"
                value={localFilters.projectId || ""}
                onChange={(e) => handleFilterChange("projectId", e.target.value)}
              >
                <option value="">All Projects</option>
                {filteredProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="timeline-billed" className="text-xs">Billed Status</Label>
            <Select
              id="timeline-billed"
              value={localFilters.billed || ""}
              onChange={(e) => handleFilterChange("billed", e.target.value)}
            >
              <option value="">All</option>
              <option value="true">Billed</option>
              <option value="false">Unbilled</option>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="timeline-type" className="text-xs">Type</Label>
            <Select
              id="timeline-type"
              value={localFilters.type || ""}
              onChange={(e) => handleFilterChange("type", e.target.value)}
            >
              <option value="">Both</option>
              <option value="timesheet">Timesheet Entries</option>
              <option value="charge">Charges</option>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="timeline-start-date" className="text-xs">Start Date</Label>
            <Input
              id="timeline-start-date"
              type="date"
              value={localFilters.startDate || ""}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="timeline-end-date" className="text-xs">End Date</Label>
            <Input
              id="timeline-end-date"
              type="date"
              value={localFilters.endDate || ""}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
