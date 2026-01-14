"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { TodoStatus, TodoPriority } from "@prisma/client"

interface TodoTimelineFiltersProps {
  projects: Array<{ id: string; name: string }>
  users: Array<{ id: string; name: string }>
  clients?: Array<{ id: string; name: string; company?: string | null }>
  onFilterChange: (filters: TodoTimelineFilters) => void
  defaultAssignedTo?: string
}

export interface TodoTimelineFilters {
  assignedTo?: string
  createdBy?: string
  projectId?: string
  clientId?: string
  status?: string
  priority?: string
  startDate?: string
  endDate?: string
  includeCompleted?: boolean
}

export function TodoTimelineFilters({
  projects,
  users,
  clients = [],
  onFilterChange,
  defaultAssignedTo = "",
}: TodoTimelineFiltersProps) {
  const [filters, setFilters] = useState<TodoTimelineFilters>({
    assignedTo: defaultAssignedTo,
    includeCompleted: false,
  })

  useEffect(() => {
    onFilterChange(filters)
  }, [filters, onFilterChange])

  const handleFilterChange = (key: keyof TodoTimelineFilters, value: string | boolean | undefined) => {
    const newFilters = {
      ...filters,
      [key]: value === "" ? undefined : value,
    }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const clearFilters = () => {
    setFilters({
      assignedTo: defaultAssignedTo,
      includeCompleted: false,
    })
  }

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === "includeCompleted") return value === true
    if (key === "assignedTo") return value !== defaultAssignedTo && value !== ""
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
          <div className="space-y-1">
            <Label htmlFor="timeline-assigned" className="text-xs">Assigned To</Label>
            <Select
              id="timeline-assigned"
              value={filters.assignedTo || ""}
              onChange={(e) => handleFilterChange("assignedTo", e.target.value)}
            >
              <option value="">All Users</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="timeline-created" className="text-xs">Created By</Label>
            <Select
              id="timeline-created"
              value={filters.createdBy || ""}
              onChange={(e) => handleFilterChange("createdBy", e.target.value)}
            >
              <option value="">All Creators</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </div>

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

          <div className="space-y-1">
            <Label htmlFor="timeline-status" className="text-xs">Status</Label>
            <Select
              id="timeline-status"
              value={filters.status || ""}
              onChange={(e) => handleFilterChange("status", e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value={TodoStatus.PENDING}>Pending</option>
              <option value={TodoStatus.IN_PROGRESS}>In Progress</option>
              <option value={TodoStatus.COMPLETED}>Completed</option>
              <option value={TodoStatus.CANCELLED}>Cancelled</option>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="timeline-priority" className="text-xs">Priority</Label>
            <Select
              id="timeline-priority"
              value={filters.priority || ""}
              onChange={(e) => handleFilterChange("priority", e.target.value)}
            >
              <option value="">All Priorities</option>
              <option value={TodoPriority.LOW}>Low</option>
              <option value={TodoPriority.MEDIUM}>Medium</option>
              <option value={TodoPriority.HIGH}>High</option>
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

          <div className="flex items-center space-x-2 pt-6">
            <Checkbox
              id="timeline-include-completed"
              checked={filters.includeCompleted || false}
              onCheckedChange={(checked) => handleFilterChange("includeCompleted", checked as boolean)}
            />
            <Label htmlFor="timeline-include-completed" className="text-xs cursor-pointer">
              Include Completed
            </Label>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
