"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { formatDate } from "@/lib/utils"
import { CheckCircle2, Circle, Clock, XCircle, Eye, EyeOff, Edit, Trash2, ExternalLink, Lock } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

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
  }
  currentUserId: string
  onMarkRead?: () => void
  onMarkUnread?: () => void
  onStatusChange?: (status: string) => void
  onDelete?: () => void
}

export function TodoCard({
  todo,
  currentUserId,
  onMarkRead,
  onMarkUnread,
  onStatusChange,
  onDelete,
}: TodoCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isAssigned = todo.assignedTo === currentUserId

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case "IN_PROGRESS":
        return <Clock className="h-4 w-4 text-blue-600" />
      case "CANCELLED":
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Circle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800"
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800"
      case "CANCELLED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "HIGH":
        return "bg-red-100 text-red-800"
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleMarkRead = async () => {
    if (!isAssigned) return
    setLoading(true)
    try {
      const response = await fetch(`/api/todos/${todo.id}/mark-read`, {
        method: "POST",
      })
      if (response.ok && onMarkRead) {
        onMarkRead()
      }
    } catch (error) {
      console.error("Error marking as read:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkUnread = async () => {
    if (!isAssigned) return
    setLoading(true)
    try {
      const response = await fetch(`/api/todos/${todo.id}/mark-unread`, {
        method: "POST",
      })
      if (response.ok && onMarkUnread) {
        onMarkUnread()
      }
    } catch (error) {
      console.error("Error marking as unread:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/todos/${todo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (response.ok && onStatusChange) {
        onStatusChange(newStatus)
        router.refresh()
      }
    } catch (error) {
      console.error("Error updating status:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this ToDo?")) return
    setLoading(true)
    try {
      const response = await fetch(`/api/todos/${todo.id}`, {
        method: "DELETE",
      })
      if (response.ok && onDelete) {
        onDelete()
      }
    } catch (error) {
      console.error("Error deleting todo:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCardClick = () => {
    router.push(`/dashboard/todos/${todo.id}/edit`)
  }

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={handleCardClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              {getStatusIcon(todo.status)}
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
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(todo.status)}`}>
                {todo.status.replace("_", " ")}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(todo.priority)}`}>
                {todo.priority} Priority
              </span>
              <span className="text-xs text-gray-500">
                Assigned to: {todo.assignments && todo.assignments.length > 0 
                  ? todo.assignments.map((a: any) => a.user?.name || a.userName || "Unknown").join(", ")
                  : todo.assignee?.name || "Unknown"}
              </span>
              {todo.dueDate && (
                <span className={`text-xs ${new Date(todo.dueDate) < new Date() && todo.status !== "COMPLETED" ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                  Due: {formatDate(todo.dueDate)}
                </span>
              )}
            </div>
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
  )
}

