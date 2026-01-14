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
  projects?: Array<{ id: string; name: string }>
  clients?: Array<{ id: string; name: string; company?: string | null }>
  onFilterChange: (filters: TimesheetTimelineFilters) => void
  currentUserId: string
  userRole: string
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
}: TimesheetTimelineFiltersProps) {
  const [filters, setFilters] = useState<TimesheetTimelineFilters>({
    userId: userRole === "STAFF" ? currentUserId : undefined,
  })

  useEffect(() => {
    onFilterChange(filters)
  }, [filters, onFilterChange])

  const handleFilterChange = (key: keyof TimesheetTimelineFilters, value: string | undefined) => {
    const newFilters = {
      ...filters,
      [key]: value === "" ? undefined : value,
    }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const clearFilters = () => {
    setFilters({
      userId: userRole === "STAFF" ? currentUserId : undefined,
    })
  }

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {(userRole === "ADMIN" || userRole === "MANAGER") && (
            <div className="space-y-1">
              <Label htmlFor="timeline-user" className="text-xs">User</Label>
              <Select
                id="timeline-user"
                value={filters.userId || ""}
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
                value={filters.clientId || ""}
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

          {projects.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="timeline-project" className="text-xs">Project</Label>
              <Select
                id="timeline-project"
                value={filters.projectId || ""}
                onChange={(e) => handleFilterChange("projectId", e.target.value)}
              >
                <option value="">All Projects</option>
                {projects.map((project) => (
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
              value={filters.billed || ""}
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
              value={filters.type || ""}
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
              value={filters.startDate || ""}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="timeline-end-date" className="text-xs">End Date</Label>
            <Input
              id="timeline-end-date"
              type="date"
              value={filters.endDate || ""}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
