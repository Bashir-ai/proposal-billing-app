"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Plus, X } from "lucide-react"
import { formatDate, formatCurrency } from "@/lib/utils"
import { ProjectStatus } from "@prisma/client"

interface Project {
  id: string
  name: string
  description?: string | null
  status: ProjectStatus
  startDate?: Date | null
  endDate?: Date | null
  client: {
    id: string
    name: string
    company?: string | null
  }
  proposal?: {
    id: string
    title: string
    amount?: number | null
    createdBy?: string | null
    creator?: {
      id: string
      name: string
      email: string
    } | null
    tags?: Array<{
      id: string
      name: string
      color?: string | null
    }>
  } | null
  bills: Array<{
    id: string
    amount: number
    status: string
  }>
}

interface Client {
  id: string
  name: string
  company?: string | null
}

interface User {
  id: string
  name: string
  email: string
}

interface Tag {
  id: string
  name: string
  color?: string | null
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<Client[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  
  // Filter state
  const [filters, setFilters] = useState({
    status: "",
    clientId: "",
    tagId: "",
    name: "",
    responsiblePersonId: "",
    projectManagerId: "",
  })

  // Read query parameters from URL on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const statusParam = params.get("status")
      
      if (statusParam) {
        // Support comma-separated status values - API will handle multiple
        // For the filter dropdown, use the first status or a combined value
        const statuses = statusParam.split(",").map(s => s.trim())
        if (statuses.length === 1) {
          setFilters(prev => ({ ...prev, status: statuses[0] }))
        } else {
          // For multiple statuses, we can't set a single dropdown value
          // But the API will handle the comma-separated string
          // We'll keep the filter empty but the API call will use the query param
          // Actually, let's store the combined value and handle it in fetchProjects
          setFilters(prev => ({ ...prev, status: statusParam }))
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchClients()
    fetchUsers()
    fetchTags()
  }, [])

  const fetchClients = async () => {
    try {
      const response = await fetch("/api/clients")
      if (response.ok) {
        const data = await response.json()
        setClients(data)
      }
    } catch (error) {
      console.error("Failed to fetch clients:", error)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users")
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (error) {
      console.error("Failed to fetch users:", error)
    }
  }

  const fetchTags = async () => {
    try {
      const response = await fetch("/api/proposal-tags")
      if (response.ok) {
        const data = await response.json()
        setTags(data)
      }
    } catch (error) {
      console.error("Failed to fetch tags:", error)
    }
  }

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      
      // Check if there's a status in URL query params (for navigation from dashboard)
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search)
        const urlStatus = urlParams.get("status")
        if (urlStatus) {
          params.append("status", urlStatus)
        } else if (filters.status) {
          params.append("status", filters.status)
        }
      } else if (filters.status) {
        params.append("status", filters.status)
      }
      
      if (filters.clientId) params.append("clientId", filters.clientId)
      if (filters.tagId) params.append("tagId", filters.tagId)
      if (filters.name) params.append("name", filters.name)
      if (filters.responsiblePersonId) params.append("responsiblePersonId", filters.responsiblePersonId)
      if (filters.projectManagerId) params.append("projectManagerId", filters.projectManagerId)

      const response = await fetch(`/api/projects?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setProjects(data)
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error)
    } finally {
      setLoading(false)
    }
  }, [filters])

  // Fetch projects when filters change or on mount
  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const clearFilters = () => {
    setFilters({
      status: "",
      clientId: "",
      tagId: "",
      name: "",
      responsiblePersonId: "",
      projectManagerId: "",
    })
  }

  const hasActiveFilters = Object.values(filters).some((value) => value !== "")

  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800"
      case "COMPLETED":
        return "bg-blue-100 text-blue-800"
      case "ON_HOLD":
        return "bg-yellow-100 text-yellow-800"
      case "CANCELLED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const calculateTotalBilled = (bills: Project["bills"]) => {
    return bills.reduce((sum, bill) => sum + bill.amount, 0)
  }

  if (loading) {
    return <div>Loading projects...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-gray-600 mt-2">Manage your active projects</p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Filters Section */}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Name Search */}
            <div className="space-y-2">
              <Label htmlFor="filter-name">Name</Label>
              <Input
                id="filter-name"
                placeholder="Search by name..."
                value={filters.name}
                onChange={(e) => handleFilterChange("name", e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="filter-status">Status</Label>
              <Select
                id="filter-status"
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="CANCELLED">Cancelled</option>
              </Select>
            </div>

            {/* Client Filter */}
            <div className="space-y-2">
              <Label htmlFor="filter-client">Client</Label>
              <Select
                id="filter-client"
                value={filters.clientId}
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

            {/* Tag Filter */}
            <div className="space-y-2">
              <Label htmlFor="filter-tag">Tag</Label>
              <Select
                id="filter-tag"
                value={filters.tagId}
                onChange={(e) => handleFilterChange("tagId", e.target.value)}
              >
                <option value="">All Tags</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Person Responsible Filter */}
            <div className="space-y-2">
              <Label htmlFor="filter-responsible">Person Responsible</Label>
              <Select
                id="filter-responsible"
                value={filters.responsiblePersonId}
                onChange={(e) => handleFilterChange("responsiblePersonId", e.target.value)}
              >
                <option value="">All People</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Project Manager Filter */}
            <div className="space-y-2">
              <Label htmlFor="filter-project-manager">Project Manager</Label>
              <Select
                id="filter-project-manager"
                value={filters.projectManagerId}
                onChange={(e) => handleFilterChange("projectManagerId", e.target.value)}
              >
                <option value="">All Managers</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      {hasActiveFilters && (
        <div className="mb-4 text-sm text-gray-600">
          Found {projects.length} project{projects.length !== 1 ? "s" : ""} matching your filters
        </div>
      )}

      <div className="space-y-4">
        {projects.map((project) => {
          const totalBilled = calculateTotalBilled(project.bills)
          const proposedAmount = project.proposal?.amount || 0
          const variance = proposedAmount - totalBilled

          return (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold">{project.name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                          {project.status}
                        </span>
                        {project.proposal && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            From Proposal
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        Client: {project.client.name}
                        {project.client.company && ` (${project.client.company})`}
                      </p>
                      {project.projectManagers && project.projectManagers.length > 0 && (
                        <p className="text-sm text-gray-600 mb-2">
                          Managers: {project.projectManagers.map((pm: any) => pm.user.name).join(", ")}
                        </p>
                      )}
                      {project.description && (
                        <p className="text-sm text-gray-500 line-clamp-2 mb-2">{project.description}</p>
                      )}
                      {project.proposal && (
                        <div className="mt-3 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Proposed:</span>
                            <span className="font-semibold">{formatCurrency(proposedAmount)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Billed:</span>
                            <span className="font-semibold">{formatCurrency(totalBilled)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Variance:</span>
                            <span className={`font-semibold ${variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {formatCurrency(variance)}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500">
                        {project.startDate && (
                          <>
                            <span>Started: {formatDate(project.startDate)}</span>
                            {project.endDate && (
                              <>
                                <span>•</span>
                                <span>Ended: {formatDate(project.endDate)}</span>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {projects.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            {hasActiveFilters ? (
              <>
                <p className="text-gray-500 mb-4">No projects found matching your filters</p>
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </>
            ) : (
              <>
                <p className="text-gray-500 mb-4">No projects yet</p>
                <Link href="/projects/new">
                  <Button>Create Your First Project</Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

