"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TodoKanbanCard } from "./TodoKanbanCard"
import { TodoStatus } from "@prisma/client"
import { toast } from "sonner"

interface Todo {
  id: string
  title: string
  description?: string | null
  dueDate: string | null
  status: TodoStatus
  priority: string
  assignee: {
    id: string
    name: string
    email: string
  } | null
  project: {
    id: string
    name: string
    client?: {
      id: string
      name: string
      company?: string | null
    } | null
  } | null
}

interface TodoKanbanProps {
  initialFilters?: {
    assignedTo?: string
    createdBy?: string
    projectId?: string
    clientId?: string
    status?: string
    priority?: string
    includeCompleted?: boolean
  }
  currentUserId: string
}

type KanbanColumn = "To Do" | "In Progress" | "Review" | "Done"

const COLUMN_STATUS_MAP: Record<KanbanColumn, TodoStatus> = {
  "To Do": TodoStatus.PENDING,
  "In Progress": TodoStatus.IN_PROGRESS,
  "Review": TodoStatus.IN_PROGRESS, // Review is also IN_PROGRESS, we'll handle it differently if needed
  "Done": TodoStatus.COMPLETED,
}

const COLUMNS: KanbanColumn[] = ["To Do", "In Progress", "Review", "Done"]

export function TodoKanban({ initialFilters, currentUserId }: TodoKanbanProps) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [draggedTodo, setDraggedTodo] = useState<Todo | null>(null)
  const [filters, setFilters] = useState(initialFilters || {})

  useEffect(() => {
    fetchTodos()
  }, [filters])

  const fetchTodos = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.assignedTo) params.append("assignedTo", filters.assignedTo)
      if (filters.createdBy) params.append("createdBy", filters.createdBy)
      if (filters.projectId) params.append("projectId", filters.projectId)
      if (filters.clientId) params.append("clientId", filters.clientId)
      if (filters.status) params.append("status", filters.status)
      if (filters.priority) params.append("priority", filters.priority)
      if (filters.includeCompleted) params.append("includeCompleted", "true")

      const response = await fetch(`/api/todos?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setTodos(data)
      }
    } catch (error) {
      console.error("Failed to fetch todos:", error)
      toast.error("Failed to load todos")
    } finally {
      setLoading(false)
    }
  }

  const handleDragStart = (e: React.DragEvent, todo: Todo) => {
    setDraggedTodo(todo)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", todo.id)
  }

  const handleDragEnd = () => {
    setDraggedTodo(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = async (e: React.DragEvent, targetColumn: KanbanColumn) => {
    e.preventDefault()
    if (!draggedTodo) return

    const targetStatus = COLUMN_STATUS_MAP[targetColumn]

    // Don't update if status hasn't changed
    if (draggedTodo.status === targetStatus) {
      return
    }

    try {
      const response = await fetch(`/api/todos/${draggedTodo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      })

      if (!response.ok) {
        throw new Error("Failed to update todo status")
      }

      const updatedTodo = await response.json()
      setTodos((prevTodos) =>
        prevTodos.map((todo) => (todo.id === updatedTodo.id ? updatedTodo : todo))
      )
      toast.success(`Todo moved to ${targetColumn}`)
    } catch (error) {
      console.error("Error updating todo:", error)
      toast.error("Failed to update todo status")
    } finally {
      setDraggedTodo(null)
    }
  }

  const getTodosForColumn = (column: KanbanColumn): Todo[] => {
    const targetStatus = COLUMN_STATUS_MAP[column]
    // For "Review" column, we could filter by a specific flag or keep as IN_PROGRESS
    // For now, we'll show all IN_PROGRESS todos in both "In Progress" and "Review"
    // You can enhance this later with a review flag
    if (column === "Review") {
      // For now, show empty or filter by some criteria
      return todos.filter((todo) => todo.status === TodoStatus.IN_PROGRESS && todo.priority === "HIGH")
    }
    return todos.filter((todo) => todo.status === targetStatus)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Loading Kanban board...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 min-w-max pb-4">
        {COLUMNS.map((column) => {
          const columnTodos = getTodosForColumn(column)
          return (
            <Card
              key={column}
              className="flex-shrink-0 w-80"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {column} ({columnTodos.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 min-h-[400px] max-h-[600px] overflow-y-auto">
                {columnTodos.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-8">
                    No todos in this column
                  </div>
                ) : (
                  columnTodos.map((todo) => (
                    <TodoKanbanCard
                      key={todo.id}
                      todo={todo}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
