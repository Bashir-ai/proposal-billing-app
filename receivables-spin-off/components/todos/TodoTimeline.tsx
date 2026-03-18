"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/utils"
import { TodoPriority, TodoStatus } from "@prisma/client"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

interface Todo {
  id: string
  title: string
  description?: string | null
  dueDate: string | null
  status: TodoStatus
  priority: TodoPriority
  assignee: {
    id: string
    name: string
    email: string
  } | null
  creator: {
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

interface TodoTimelineProps {
  initialFilters?: {
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
  currentUserId: string
}

type ViewMode = "week" | "month"

export function TodoTimeline({ initialFilters, currentUserId }: TodoTimelineProps) {
  const router = useRouter()
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>("month")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [filters, setFilters] = useState(initialFilters || {})

  const handleTodoClick = (todo: Todo) => {
    router.push(`/dashboard/todos/${todo.id}/edit`)
  }

  // Calculate date range based on view mode
  const { startDate, endDate, dateHeaders } = useMemo(() => {
    const start = new Date(currentDate)
    const end = new Date(currentDate)
    const headers: string[] = []

    if (viewMode === "week") {
      // Start of week (Monday)
      const day = start.getDay()
      const diff = start.getDate() - day + (day === 0 ? -6 : 1)
      start.setDate(diff)
      start.setHours(0, 0, 0, 0)

      // End of week (Sunday)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)

      // Generate headers for each day
      for (let i = 0; i < 7; i++) {
        const date = new Date(start)
        date.setDate(start.getDate() + i)
        headers.push(date.toISOString().split("T")[0])
      }
    } else {
      // Start of month
      start.setDate(1)
      start.setHours(0, 0, 0, 0)

      // End of month
      end.setMonth(start.getMonth() + 1)
      end.setDate(0)
      end.setHours(23, 59, 59, 999)

      // Generate headers for each day in month
      const daysInMonth = end.getDate()
      for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(start)
        date.setDate(i)
        headers.push(date.toISOString().split("T")[0])
      }
    }

    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
      dateHeaders: headers,
    }
  }, [currentDate, viewMode])

  useEffect(() => {
    fetchTodos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, startDate, endDate])

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
      params.append("startDate", startDate)
      params.append("endDate", endDate)
      // Timeline API already excludes COMPLETED by default when includeCompleted is not true
      if (filters.includeCompleted) params.append("includeCompleted", "true")

      const response = await fetch(`/api/todos/timeline?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setTodos(data.todos || [])
      }
    } catch (error) {
      console.error("Failed to fetch todos:", error)
    } finally {
      setLoading(false)
    }
  }

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate)
    if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7))
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1))
    }
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // Group todos by date
  const todosByDate = useMemo(() => {
    const grouped: Record<string, Todo[]> = {}
    todos.forEach(todo => {
      if (todo.dueDate) {
        const dateKey = todo.dueDate.split("T")[0]
        if (!grouped[dateKey]) {
          grouped[dateKey] = []
        }
        grouped[dateKey].push(todo)
      }
    })
    return grouped
  }, [todos])

  const getPriorityColor = (priority: TodoPriority) => {
    switch (priority) {
      case "HIGH":
        return "bg-red-100 border-red-300 text-red-800"
      case "MEDIUM":
        return "bg-yellow-100 border-yellow-300 text-yellow-800"
      case "LOW":
        return "bg-green-100 border-green-300 text-green-800"
      default:
        return "bg-gray-100 border-gray-300 text-gray-800"
    }
  }

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false
    return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString()
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Loading timeline...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>ToDo Timeline</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === "week" ? "month" : "week")}
            >
              {viewMode === "week" ? "Month View" : "Week View"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
            >
              <Calendar className="h-4 w-4 mr-1" />
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate("prev")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate("next")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          {viewMode === "week" 
            ? `${formatDate(new Date(startDate))} - ${formatDate(new Date(endDate))}`
            : new Date(currentDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })
          }
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-full">
            {/* Date Headers */}
            <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: `repeat(${dateHeaders.length}, minmax(120px, 1fr))` }}>
              {dateHeaders.map(dateStr => {
                const date = new Date(dateStr)
                const isToday = dateStr === new Date().toISOString().split("T")[0]
                return (
                  <div
                    key={dateStr}
                    className={cn(
                      "text-center p-2 border rounded",
                      isToday && "bg-blue-50 border-blue-300 font-semibold"
                    )}
                  >
                    <div className="text-xs text-gray-500">
                      {date.toLocaleDateString("en-US", { weekday: "short" })}
                    </div>
                    <div className="text-sm font-medium">
                      {date.getDate()}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Timeline Grid - One row per date */}
            <div className="space-y-2">
              {dateHeaders.map((dateStr, rowIdx) => {
                const dayTodos = todosByDate[dateStr] || []
                const date = new Date(dateStr)
                const isToday = dateStr === new Date().toISOString().split("T")[0]
                const isPast = date < new Date() && !isToday

                return (
                  <div
                    key={dateStr}
                    className={cn(
                      "grid gap-2 p-2 border rounded min-h-[80px]",
                      isToday && "bg-blue-50 border-blue-300",
                      isPast && "bg-gray-50"
                    )}
                    style={{ gridTemplateColumns: `repeat(${dateHeaders.length}, minmax(120px, 1fr))` }}
                  >
                    {dateHeaders.map((headerDate, colIdx) => {
                      if (headerDate === dateStr) {
                        return (
                          <div key={colIdx} className="space-y-1">
                            {dayTodos.map(todo => (
                              <div
                                key={todo.id}
                                onClick={() => handleTodoClick(todo)}
                                className={cn(
                                  "p-2 rounded border text-xs cursor-pointer hover:shadow-md transition-shadow",
                                  getPriorityColor(todo.priority),
                                  isOverdue(todo.dueDate) && "border-red-500 border-2"
                                )}
                                title={`${todo.title}\n${todo.description || ""}\nAssignee: ${todo.assignee?.name || "Unassigned"}\nPriority: ${todo.priority}`}
                              >
                                <div className="font-medium truncate">{todo.title}</div>
                                {todo.project && (
                                  <div className="text-xs opacity-75 truncate">{todo.project.name}</div>
                                )}
                                {todo.assignee && (
                                  <div className="text-xs opacity-75 truncate">{todo.assignee.name}</div>
                                )}
                              </div>
                            ))}
                            {dayTodos.length === 0 && (
                              <div className="text-xs text-gray-400 text-center py-2">No todos</div>
                            )}
                          </div>
                        )
                      }
                      return <div key={colIdx}></div>
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
