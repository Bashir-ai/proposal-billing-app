"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { X } from "lucide-react"

interface TodoFilterProps {
  projects: Array<{ id: string; name: string }>
  proposals: Array<{ id: string; title: string }>
  invoices: Array<{ id: string; invoiceNumber?: string | null }>
  users: Array<{ id: string; name: string }>
  onFilterChange: (filters: TodoFilters) => void
}

export interface TodoFilters {
  projectId: string
  proposalId: string
  invoiceId: string
  assignedTo: string
  createdBy: string
  status: string
  priority: string
  read: string
  hidePersonal: boolean
  deadlineFilter: string
}

export function TodoFilter({
  projects,
  proposals,
  invoices,
  users,
  onFilterChange,
}: TodoFilterProps) {
  const [filters, setFilters] = useState<TodoFilters>({
    projectId: "",
    proposalId: "",
    invoiceId: "",
    assignedTo: "",
    createdBy: "",
    status: "",
    priority: "",
    read: "",
    hidePersonal: false,
    deadlineFilter: "",
  })

  useEffect(() => {
    onFilterChange(filters)
  }, [filters, onFilterChange])

  const handleFilterChange = (key: keyof TodoFilters, value: string | boolean) => {
    const newFilters = {
      ...filters,
      [key]: typeof value === "boolean" ? value : value,
    }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const clearFilters = () => {
    setFilters({
      projectId: "",
      proposalId: "",
      invoiceId: "",
      assignedTo: "",
      createdBy: "",
      status: "",
      priority: "",
      read: "",
      hidePersonal: false,
      deadlineFilter: "",
    })
  }

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === "hidePersonal") return value === true
    return value !== ""
  })

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Filters</h2>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="text-sm"
            >
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="filter-project">Project</Label>
            <Select
              id="filter-project"
              value={filters.projectId}
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

          <div className="space-y-2">
            <Label htmlFor="filter-proposal">Proposal</Label>
            <Select
              id="filter-proposal"
              value={filters.proposalId}
              onChange={(e) => handleFilterChange("proposalId", e.target.value)}
            >
              <option value="">All Proposals</option>
              {proposals.map((proposal) => (
                <option key={proposal.id} value={proposal.id}>
                  {proposal.title}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filter-invoice">Invoice</Label>
            <Select
              id="filter-invoice"
              value={filters.invoiceId}
              onChange={(e) => handleFilterChange("invoiceId", e.target.value)}
            >
              <option value="">All Invoices</option>
              {invoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoiceNumber || invoice.id.slice(0, 8)}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filter-assigned">Assigned To</Label>
            <Select
              id="filter-assigned"
              value={filters.assignedTo}
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

          <div className="space-y-2">
            <Label htmlFor="filter-created">Created By</Label>
            <Select
              id="filter-created"
              value={filters.createdBy}
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

          <div className="space-y-2">
            <Label htmlFor="filter-status">Status</Label>
            <Select
              id="filter-status"
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filter-priority">Priority</Label>
            <Select
              id="filter-priority"
              value={filters.priority}
              onChange={(e) => handleFilterChange("priority", e.target.value)}
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filter-read">Read Status</Label>
            <Select
              id="filter-read"
              value={filters.read}
              onChange={(e) => handleFilterChange("read", e.target.value)}
            >
              <option value="">All</option>
              <option value="true">Read</option>
              <option value="false">Unread</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filter-deadlineFilter">Deadline Status</Label>
            <Select
              id="filter-deadlineFilter"
              value={filters.deadlineFilter}
              onChange={(e) => handleFilterChange("deadlineFilter", e.target.value)}
            >
              <option value="">All</option>
              <option value="late">Late</option>
              <option value="approaching">Approaching (within 3 days)</option>
              <option value="in_time">In Time</option>
            </Select>
          </div>

          <div className="space-y-2 flex items-center pt-6">
            <input
              type="checkbox"
              id="filter-hidePersonal"
              checked={filters.hidePersonal}
              onChange={(e) => handleFilterChange("hidePersonal", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="filter-hidePersonal" className="ml-2 cursor-pointer">
              Hide personal ToDos
            </Label>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

