"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
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
  } | null
  bills: Array<{
    id: string
    amount: number
    status: string
  }>
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects")
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
        <Link href="/dashboard/projects/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        {projects.map((project) => {
          const totalBilled = calculateTotalBilled(project.bills)
          const proposedAmount = project.proposal?.amount || 0
          const variance = proposedAmount - totalBilled

          return (
            <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
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
            <p className="text-gray-500 mb-4">No projects yet</p>
            <Link href="/dashboard/projects/new">
              <Button>Create Your First Project</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


