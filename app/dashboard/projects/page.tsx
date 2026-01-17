"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Plus, X } from "lucide-react"
import { formatDate, formatCurrency } from "@/lib/utils"
import { ProjectStatus } from "@prisma/client"
import { LoadingState } from "@/components/shared/LoadingState"
import { ProjectsList } from "@/components/projects/ProjectsList"

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

export default function ProjectsPage() {
  const { data: session } = useSession()
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    clientId: "",
    name: "",
    status: "",
  })
  
  const isAdmin = session?.user?.role === "ADMIN"

  useEffect(() => {
    fetchClients()
    fetchProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

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

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.clientId) params.set("clientId", filters.clientId)
      if (filters.name) params.set("name", filters.name)
      if (filters.status) params.set("status", filters.status)

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
  }

  const clearFilters = () => {
    setFilters({
      clientId: "",
      name: "",
      status: "",
    })
  }

  const hasActiveFilters = filters.clientId || filters.name || filters.status

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
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Projects</h1>
            <p className="text-gray-600 mt-2">Manage your active projects</p>
          </div>
        </div>
        <LoadingState message="Loading projects..." variant="skeleton" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-gray-600 mt-2">Manage your active projects</p>
        </div>
        <Link href="/dashboard/projects/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientFilter">Client</Label>
              <Select
                id="clientFilter"
                value={filters.clientId}
                onChange={(e) => setFilters({ ...filters, clientId: e.target.value })}
              >
                <option value="">All Clients</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} {client.company ? `(${client.company})` : ""}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nameFilter">Project Name</Label>
              <Input
                id="nameFilter"
                type="text"
                placeholder="Search by name..."
                value={filters.name}
                onChange={(e) => setFilters({ ...filters, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="statusFilter">Status</Label>
              <Select
                id="statusFilter"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="CANCELLED">Cancelled</option>
              </Select>
            </div>

            <div className="space-y-2 flex items-end">
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="w-full"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <ProjectsList projects={projects} isAdmin={isAdmin} />

      {projects.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">
              {hasActiveFilters ? "No projects match your filters" : "No projects yet"}
            </p>
            {hasActiveFilters ? (
              <Button onClick={clearFilters} variant="outline">
                Clear Filters
              </Button>
            ) : (
              <Link href="/dashboard/projects/new">
                <Button>Create Your First Project</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}


