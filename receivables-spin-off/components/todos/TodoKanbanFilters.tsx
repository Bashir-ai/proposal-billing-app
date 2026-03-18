"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { X, Filter } from "lucide-react"

interface TodoKanbanFiltersProps {
  users: Array<{ id: string; name: string }>
  onFilterChange: (filters: TodoKanbanFilters) => void
  currentUserId: string
  defaultAssignedTo?: string
  initialFilters?: TodoKanbanFilters
}

export interface TodoKanbanFilters {
  assignedTo?: string
  assignedFilter?: "me" | "others" | "everyone"
  createdBy?: string
  projectId?: string
  clientId?: string
  status?: string
  priority?: string
  includeCompleted?: boolean
}

export function TodoKanbanFilters({
  users,
  onFilterChange,
  currentUserId,
  defaultAssignedTo = "",
  initialFilters,
}: TodoKanbanFiltersProps) {
  const [localFilters, setLocalFilters] = useState<TodoKanbanFilters>(initialFilters || {
    assignedFilter: defaultAssignedTo ? "me" : "everyone",
    assignedTo: defaultAssignedTo,
    includeCompleted: false,
  })

  useEffect(() => {
    if (initialFilters) {
      setLocalFilters(initialFilters)
    }
  }, [initialFilters])

  const handleAssignedFilterChange = (value: "me" | "others" | "everyone") => {
    let assignedTo: string | undefined
    if (value === "me") {
      assignedTo = currentUserId
    } else if (value === "others") {
      assignedTo = undefined // We'll filter in the component
    } else {
      assignedTo = undefined // Everyone
    }

    setLocalFilters({
      ...localFilters,
      assignedFilter: value,
      assignedTo,
    })
  }

  const handleFilterChange = (key: keyof TodoKanbanFilters, value: string | boolean | undefined) => {
    const newFilters = {
      ...localFilters,
      [key]: value === "" ? undefined : value,
    }
    setLocalFilters(newFilters)
  }

  const applyFilters = () => {
    onFilterChange(localFilters)
  }

  const clearFilters = () => {
    const cleared: TodoKanbanFilters = {
      assignedFilter: (defaultAssignedTo ? "me" : "everyone") as "me" | "others" | "everyone",
      assignedTo: defaultAssignedTo,
      includeCompleted: false,
    }
    setLocalFilters(cleared)
    onFilterChange(cleared)
  }

  const hasActiveFilters = Object.entries(localFilters).some(([key, value]) => {
    if (key === "includeCompleted") return value === true
    if (key === "assignedFilter") return value !== (defaultAssignedTo ? "me" : "everyone")
    if (key === "assignedTo") return value !== defaultAssignedTo && value !== ""
    return value !== undefined && value !== ""
  })

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Kanban Filters</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={applyFilters}
              className="text-xs h-7"
            >
              <Filter className="h-3 w-3 mr-1" />
              Apply
            </Button>
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
          <div className="space-y-1">
            <Label htmlFor="kanban-assigned-filter" className="text-xs">Assigned To</Label>
            <Select
              id="kanban-assigned-filter"
              value={localFilters.assignedFilter || "everyone"}
              onChange={(e) => handleAssignedFilterChange(e.target.value as "me" | "others" | "everyone")}
            >
              <option value="me">Assigned to Me</option>
              <option value="others">Assigned to Others</option>
              <option value="everyone">Everyone</option>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="kanban-created" className="text-xs">Created By</Label>
            <Select
              id="kanban-created"
              value={localFilters.createdBy || ""}
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
            <Label htmlFor="kanban-priority" className="text-xs">Priority</Label>
            <Select
              id="kanban-priority"
              value={localFilters.priority || ""}
              onChange={(e) => handleFilterChange("priority", e.target.value)}
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
