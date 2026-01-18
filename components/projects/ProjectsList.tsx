"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash2, Archive } from "lucide-react"
import { BulkDeleteDialog } from "@/components/clients/BulkDeleteDialog"
import { ProjectStatus } from "@prisma/client"
import { formatDate, formatCurrency } from "@/lib/utils"

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

interface ProjectsListProps {
  projects: Project[]
  isAdmin: boolean
  isManager?: boolean
}

export function ProjectsList({ projects, isAdmin, isManager = false }: ProjectsListProps) {
  const router = useRouter()
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [validationData, setValidationData] = useState<{
    deletable: Array<{ id: string; name: string }>
    nonDeletable: Array<{ id: string; name: string; reason: string }>
  } | null>(null)
  const [archiveValidationData, setArchiveValidationData] = useState<{
    archivable: Array<{ id: string; name: string }>
    nonArchivable: Array<{ id: string; name: string; reason: string }>
  } | null>(null)
  
  const canArchive = isAdmin || isManager

  const handleToggle = (projectId: string) => {
    const newSelected = new Set(selectedProjects)
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId)
    } else {
      newSelected.add(projectId)
    }
    setSelectedProjects(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedProjects.size === projects.length) {
      setSelectedProjects(new Set())
    } else {
      setSelectedProjects(new Set(projects.map((p) => p.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedProjects.size === 0) return

    setIsDeleting(true)
    try {
      const projectIds = Array.from(selectedProjects)
      
      const response = await fetch("/api/projects/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectIds,
          action: "validate",
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        const errorMessage = errorData.error || errorData.message || `Server returned ${response.status}`
        throw new Error(errorMessage)
      }

      const data = await response.json()
      setValidationData(data)
      setShowDeleteConfirm(true)
    } catch (error) {
      console.error("Error validating projects:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to validate projects. Please try again."
      alert(errorMessage)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleConfirmDelete = async (selectedIds: string[]) => {
    setIsDeleting(true)
    try {
      const response = await fetch("/api/projects/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectIds: selectedIds,
          action: "delete",
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || "Failed to delete projects")
      }

      const result = await response.json()
      
      setSelectedProjects(new Set())
      setShowDeleteConfirm(false)
      setValidationData(null)
      router.refresh()
      
      alert(result.message || `Successfully deleted ${selectedIds.length} project(s)`)
    } catch (error) {
      console.error("Error deleting projects:", error)
      alert(error instanceof Error ? error.message : "Failed to delete projects. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBulkArchive = async () => {
    if (selectedProjects.size === 0) return

    setIsArchiving(true)
    try {
      const projectIds = Array.from(selectedProjects)
      
      const response = await fetch("/api/projects/bulk-archive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectIds,
          action: "validate",
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        const errorMessage = errorData.error || errorData.message || `Server returned ${response.status}`
        throw new Error(errorMessage)
      }

      const data = await response.json()
      setArchiveValidationData(data)
      setShowArchiveConfirm(true)
    } catch (error) {
      console.error("Error validating projects for archive:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to validate projects. Please try again."
      alert(errorMessage)
    } finally {
      setIsArchiving(false)
    }
  }

  const handleConfirmArchive = async (selectedIds: string[]) => {
    setIsArchiving(true)
    try {
      const response = await fetch("/api/projects/bulk-archive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectIds: selectedIds,
          action: "archive",
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || "Failed to archive projects")
      }

      const result = await response.json()
      
      setSelectedProjects(new Set())
      setShowArchiveConfirm(false)
      setArchiveValidationData(null)
      router.refresh()
      
      alert(result.message || `Successfully archived ${selectedIds.length} project(s)`)
    } catch (error) {
      console.error("Error archiving projects:", error)
      alert(error instanceof Error ? error.message : "Failed to archive projects. Please try again.")
    } finally {
      setIsArchiving(false)
    }
  }

  const handleIndividualArchive = async (projectId: string) => {
    if (!confirm("Are you sure you want to archive this project? It will be hidden from the main list.")) {
      return
    }

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "archive",
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to archive project")
      }

      router.refresh()
      alert("Project archived successfully")
    } catch (error) {
      console.error("Error archiving project:", error)
      alert(error instanceof Error ? error.message : "Failed to archive project. Please try again.")
    }
  }

  const hasSelection = selectedProjects.size > 0

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

  return (
    <>
      {(isAdmin || canArchive) && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedProjects.size === projects.length && projects.length > 0}
              onCheckedChange={handleSelectAll}
              disabled={projects.length === 0}
            />
            <span className="text-sm text-gray-600">
              Select all ({projects.length} projects)
            </span>
          </div>
          {hasSelection && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {selectedProjects.size} selected
              </span>
              {canArchive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkArchive}
                  disabled={isArchiving || isDeleting}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archive Selected
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={isDeleting || isArchiving}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="space-y-6">
        {projects.map((project) => {
          const totalBilled = calculateTotalBilled(project.bills)
          const proposedAmount = project.proposal?.amount || 0
          const variance = proposedAmount - totalBilled

          return (
            <div key={project.id} className="relative">
              <div
                className="absolute top-2 right-2 z-50 flex items-center gap-1"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
              >
                {canArchive && (
                  <div className="bg-white rounded border shadow-sm p-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleIndividualArchive(project.id)
                      }}
                      className="bg-white h-7 w-7 p-0"
                    >
                      <Archive className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {isAdmin && (
                  <div className="bg-white rounded border shadow-sm p-1">
                    <Checkbox
                      checked={selectedProjects.has(project.id)}
                      onCheckedChange={() => handleToggle(project.id)}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                    />
                  </div>
                )}
              </div>
              <Link href={`/dashboard/projects/${project.id}`}>
                  <Card
                    className={`hover:shadow-lg transition-shadow ${
                      selectedProjects.has(project.id) ? "ring-2 ring-primary" : ""
                    }`}
                  >
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
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            {project.startDate && (
                              <span>Start: {formatDate(project.startDate)}</span>
                            )}
                            {project.endDate && (
                              <span>End: {formatDate(project.endDate)}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          {totalBilled > 0 && (
                            <p className="text-lg font-semibold">{formatCurrency(totalBilled)}</p>
                          )}
                          {proposedAmount > 0 && (
                            <p className="text-xs text-gray-500">
                              Proposed: {formatCurrency(proposedAmount)}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {validationData && (
        <BulkDeleteDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          deletable={validationData.deletable}
          nonDeletable={validationData.nonDeletable}
          onConfirm={handleConfirmDelete}
          isDeleting={isDeleting}
        />
      )}

      {archiveValidationData && (
        <BulkDeleteDialog
          open={showArchiveConfirm}
          onOpenChange={setShowArchiveConfirm}
          deletable={archiveValidationData.archivable}
          nonDeletable={archiveValidationData.nonArchivable}
          onConfirm={handleConfirmArchive}
          isDeleting={isArchiving}
        />
      )}
    </>
  )
}
