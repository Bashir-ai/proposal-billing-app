"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { formatDate } from "@/lib/utils"
import { CheckCircle2, Circle, Clock, XCircle, Eye, EyeOff, Edit, Trash2, ExternalLink, Lock } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, memo, useCallback, useMemo, useEffect } from "react"
import { CreateTimesheetEntryForm } from "@/components/timesheets/CreateTimesheetEntryForm"

interface TodoCardProps {
  todo: {
    id: string
    title: string
    description?: string | null
    status: string
    priority: string
    isPersonal?: boolean
    startDate?: string | null
    estimatedEndDate?: string | null
    dueDate?: string | null
    readAt?: string | null
    assignedTo: string
    assignee: {
      name: string
    }
    creator: {
      id: string
      name: string
      email: string
      role: string
    }
    project?: {
      id: string
      name: string
    } | null
    proposal?: {
      id: string
      title: string
      proposalNumber?: string | null
    } | null
    invoice?: {
      id: string
      invoiceNumber?: string | null
    } | null
    reassignments?: Array<{
      id: string
      fromUser: { name: string }
      toUser: { name: string }
      reassignedByUser: { name: string }
      reason?: string | null
      createdAt: string
    }>
    assignments?: Array<{
      id: string
      user?: { id: string; name: string }
      userName?: string
    }>
    followers?: Array<{
      id: string
      user?: { id: string; name: string }
      userId?: string
    }>
    tags?: Array<{
      id: string
      name: string
      color?: string | null
    }>
  }
  currentUserId: string
  onMarkRead?: () => void
  onMarkUnread?: () => void
  onStatusChange?: (status: string) => void
  onDelete?: () => void
}

function TodoCardComponent({
  todo,
  currentUserId,
  onMarkRead,
  onMarkUnread,
  onStatusChange,
  onDelete,
}: TodoCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showTimesheetDialog, setShowTimesheetDialog] = useState(false)
  const [timesheetData, setTimesheetData] = useState<{
    projects: Array<{ id: string; name: string; clientId?: string | null; proposal?: any }>
    users: Array<{ id: string; name: string; email: string; defaultHourlyRate?: number | null }>
    clients: Array<{ id: string; name: string; company?: string | null }>
  } | null>(null)
  const isAssigned = useMemo(() => todo.assignedTo === currentUserId, [todo.assignedTo, currentUserId])

  const statusIcon = useMemo(() => {
    switch (todo.status) {
      case "COMPLETED":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case "IN_PROGRESS":
        return <Clock className="h-4 w-4 text-blue-600" />
      case "CANCELLED":
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Circle className="h-4 w-4 text-gray-400" />
    }
  }, [todo.status])

  const statusColor = useMemo(() => {
    switch (todo.status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800"
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800"
      case "CANCELLED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }, [todo.status])

  const priorityColor = useMemo(() => {
    switch (todo.priority) {
      case "HIGH":
        return "bg-red-100 text-red-800"
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }, [todo.priority])

  const handleMarkRead = useCallback(async () => {
    if (!isAssigned) return
    setLoading(true)
    try {
      const response = await fetch(`/api/todos/${todo.id}/mark-read`, {
        method: "POST",
      })
      if (response.ok) {
        if (onMarkRead) {
          onMarkRead()
        }
        window.dispatchEvent(new Event('todos:refresh'))
      }
    } catch (error) {
      console.error("Error marking as read:", error)
    } finally {
      setLoading(false)
    }
  }, [isAssigned, todo.id, onMarkRead])

  const handleMarkUnread = useCallback(async () => {
    if (!isAssigned) return
    setLoading(true)
    try {
      const response = await fetch(`/api/todos/${todo.id}/mark-unread`, {
        method: "POST",
      })
      if (response.ok) {
        if (onMarkUnread) {
          onMarkUnread()
        }
        window.dispatchEvent(new Event('todos:refresh'))
      }
    } catch (error) {
      console.error("Error marking as unread:", error)
    } finally {
      setLoading(false)
    }
  }, [isAssigned, todo.id, onMarkUnread])

  const handleStatusChange = useCallback(async (newStatus: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/todos/${todo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (response.ok) {
        if (onStatusChange) {
          onStatusChange(newStatus)
        }
        router.refresh()
        window.dispatchEvent(new Event('todos:refresh'))
      }
    } catch (error) {
      console.error("Error updating status:", error)
    } finally {
      setLoading(false)
    }
  }, [todo.id, onStatusChange, router])

  const handleDelete = useCallback(async () => {
    if (!confirm("Are you sure you want to delete this ToDo?")) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/todos/${todo.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteForAll: false })
      })
      
      if (!response.ok) {
        const data = await response.json()
        if (data.error === "MULTIPLE_ASSIGNEES") {
          const otherAssignees = data.assignees.map((a: any) => a.name).join(", ")
          const confirmMessage = `This ToDo is also assigned to: ${otherAssignees}\n\nDo you want to delete it for all ${data.totalAssignees} users?`
          
          if (!confirm(confirmMessage)) {
            setLoading(false)
            return
          }
          
          // Delete for all users
          const deleteResponse = await fetch(`/api/todos/${todo.id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deleteForAll: true })
          })
          
          if (deleteResponse.ok) {
            if (onDelete) {
              onDelete()
            }
            window.dispatchEvent(new Event('todos:refresh'))
          } else {
            const errorData = await deleteResponse.json().catch(() => ({}))
            alert(errorData.message || "Failed to delete ToDo. Please try again.")
          }
        } else {
          throw new Error(data.message || "Failed to delete ToDo")
        }
      } else if (onDelete) {
        onDelete()
      }
    } catch (error) {
      console.error("Error deleting todo:", error)
      alert("Failed to delete ToDo. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [todo.id, onDelete])

  const handleCardClick = useCallback(() => {
    router.push(`/dashboard/todos/${todo.id}/edit`)
  }, [router, todo.id])

  const handleOpenTimesheetDialog = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowTimesheetDialog(true)
    
    // Fetch data for timesheet form
    try {
      const [projectsRes, usersRes, clientsRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/users"),
        fetch("/api/clients"),
      ])

      const projectsData = projectsRes.ok ? await projectsRes.json() : []
      const projectsArray = Array.isArray(projectsData) 
        ? projectsData 
        : (projectsData.data && Array.isArray(projectsData.data) ? projectsData.data : [])
      
      const usersData = usersRes.ok ? await usersRes.json() : []
      const usersArray = Array.isArray(usersData) ? usersData : []
      
      const clientsData = clientsRes.ok ? await clientsRes.json() : []
      const clientsArray = Array.isArray(clientsData)
        ? clientsData
        : (clientsData.data && Array.isArray(clientsData.data) ? clientsData.data : [])

      setTimesheetData({
        projects: projectsArray
          .filter((p: any) => p && !p.deletedAt && !p.archivedAt)
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            clientId: p.clientId || p.client?.id || null,
            proposal: p.proposal ? {
              id: p.proposal.id,
              type: p.proposal.type,
              blendedRate: p.proposal.blendedRate,
              useBlendedRate: p.proposal.useBlendedRate,
              hourlyRateRangeMin: p.proposal.hourlyRateRangeMin,
              hourlyRateRangeMax: p.proposal.hourlyRateRangeMax,
              hourlyRateTableRates: p.proposal.hourlyRateTableRates,
              items: p.proposal.items || []
            } : null
          })),
        users: usersArray
          .filter((u: any) => u && u.role !== "CLIENT")
          .map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            defaultHourlyRate: u.defaultHourlyRate,
          })),
        clients: clientsArray
          .filter((c: any) => c && !c.deletedAt && !c.archivedAt)
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            company: c.company,
          })),
      })
    } catch (error) {
      console.error("Failed to fetch timesheet data:", error)
    }
  }, [])

  const handleTimesheetSuccess = useCallback(() => {
    setShowTimesheetDialog(false)
    window.dispatchEvent(new Event('todos:refresh'))
  }, [])

  return (
    <>
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={handleCardClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              {statusIcon}
              <h3 className="font-semibold text-lg">{todo.title}</h3>
              {todo.isPersonal && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Personal
                </span>
              )}
              {!todo.readAt && isAssigned && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Unread
                </span>
              )}
            </div>
            {todo.description && (
              <p className="text-sm text-gray-600 mb-2">{todo.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                {todo.status.replace("_", " ")}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityColor}`}>
                {todo.priority} Priority
              </span>
              <span className="text-xs text-gray-500">
                Assigned to: {todo.assignments && todo.assignments.length > 0 
                  ? todo.assignments.map((a: any) => a.user?.name || a.userName || "Unknown").join(", ")
                  : todo.assignee?.name || "Unknown"}
              </span>
              {todo.followers && todo.followers.length > 0 && (
                <span className="text-xs text-gray-500">
                  Followers: {todo.followers.map((f: any) => f.user?.name || "Unknown").join(", ")}
                </span>
              )}
              {todo.dueDate && (
                <span className={`text-xs ${new Date(todo.dueDate) < new Date() && todo.status !== "COMPLETED" ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                  Due: {formatDate(todo.dueDate)}
                </span>
              )}
            </div>
            {todo.tags && todo.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {todo.tags.map((tag: any) => (
                  <span
                    key={tag.id}
                    className="px-2 py-0.5 rounded-full text-xs font-medium border"
                    style={tag.color ? {
                      backgroundColor: tag.color + "20",
                      borderColor: tag.color,
                      color: tag.color
                    } : {
                      backgroundColor: "#f3f4f6",
                      borderColor: "#d1d5db",
                      color: "#374151"
                    }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 text-xs text-gray-500">
              {todo.project && (
                <Link href={`/projects/${todo.project.id}`} className="flex items-center hover:text-blue-600">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Project: {todo.project.name}
                </Link>
              )}
              {todo.proposal && (
                <Link href={`/dashboard/proposals/${todo.proposal.id}`} className="flex items-center hover:text-blue-600">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Proposal: {todo.proposal.title}
                </Link>
              )}
              {todo.invoice && (
                <Link href={`/dashboard/bills/${todo.invoice.id}`} className="flex items-center hover:text-blue-600">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Invoice: {todo.invoice.invoiceNumber || todo.invoice.id.slice(0, 8)}
                </Link>
              )}
            </div>
          </div>
          <div className="flex flex-col space-y-2 ml-4">
            {isAssigned && (
              <>
                {todo.readAt ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMarkUnread()
                    }}
                    disabled={loading}
                    title="Mark as unread"
                  >
                    <EyeOff className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMarkRead()
                    }}
                    disabled={loading}
                    title="Mark as read"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
            <div className="space-y-2">
              <Select
                value={todo.status}
                onChange={(e) => {
                  e.stopPropagation()
                  handleStatusChange(e.target.value)
                }}
                onClick={(e) => e.stopPropagation()}
                disabled={loading}
                className="text-sm"
              >
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </Select>
            </div>
            {todo.project && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenTimesheetDialog}
                disabled={loading}
                title="Create timesheet entry for this todo"
              >
                <Clock className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/dashboard/todos/${todo.id}/edit`)
              }}
              disabled={loading}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                handleDelete()
              }}
              disabled={loading}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
    {showTimesheetDialog && timesheetData && (
      <CreateTimesheetEntryForm
        projects={timesheetData.projects}
        users={timesheetData.users}
        clients={timesheetData.clients}
        isOpen={showTimesheetDialog}
        onClose={() => setShowTimesheetDialog(false)}
        onSuccess={handleTimesheetSuccess}
        initialProjectId={todo.project?.id}
        initialDescription={todo.title}
        initialDate={new Date().toISOString().split("T")[0]}
      />
    )}
    </>
  )
}

export const TodoCard = memo(TodoCardComponent)