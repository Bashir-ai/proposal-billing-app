"use client"

import { useState, useEffect, useCallback } from "react"
import { TodoCard } from "./TodoCard"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { TodoFilters } from "./TodoFilter"
import { useRouter } from "next/navigation"

interface Todo {
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
}

interface TodoListProps {
  currentUserId: string
  initialFilters?: Partial<TodoFilters>
  onCreateNew?: () => void
}

export function TodoList({ currentUserId, initialFilters, onCreateNew }: TodoListProps) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Partial<TodoFilters>>(initialFilters || {})

  // Update filters when initialFilters change
  useEffect(() => {
    if (initialFilters) {
      setFilters(initialFilters)
    }
  }, [initialFilters])

  const fetchTodos = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.projectId) params.append("projectId", filters.projectId)
      if (filters.proposalId) params.append("proposalId", filters.proposalId)
      if (filters.invoiceId) params.append("invoiceId", filters.invoiceId)
      if (filters.clientId) params.append("clientId", filters.clientId)
      if (filters.assignedTo) params.append("assignedTo", filters.assignedTo)
      if (filters.createdBy) params.append("createdBy", filters.createdBy)
      if (filters.status) params.append("status", filters.status)
      if (filters.priority) params.append("priority", filters.priority)
      if (filters.read) params.append("read", filters.read)
      if (filters.hidePersonal) params.append("hidePersonal", "true")
      if (filters.deadlineFilter) params.append("deadlineFilter", filters.deadlineFilter)

      const response = await fetch(`/api/todos?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        // Handle paginated response (new format) or direct array (backward compatibility)
        if (data.data && data.pagination) {
          setTodos(data.data)
        } else {
          setTodos(data)
        }
      }
    } catch (error) {
      console.error("Failed to fetch todos:", error)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchTodos()
    
    // Listen for refresh events
    const handleRefresh = () => {
      fetchTodos()
    }
    window.addEventListener('todos:refresh', handleRefresh)
    
    return () => {
      window.removeEventListener('todos:refresh', handleRefresh)
    }
  }, [fetchTodos])

  const handleFilterChange = (newFilters: TodoFilters) => {
    setFilters(newFilters)
  }

  const handleRefresh = () => {
    fetchTodos()
  }

  if (loading) {
    return <div>Loading ToDos...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">ToDos</h2>
        {onCreateNew && (
          <Button onClick={onCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create New ToDo
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {todos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500 mb-4">No ToDos found</p>
              {onCreateNew && (
                <Button onClick={onCreateNew}>Create Your First ToDo</Button>
              )}
            </CardContent>
          </Card>
        ) : (
          todos.map((todo) => (
            <TodoCard
              key={todo.id}
              todo={todo}
              currentUserId={currentUserId}
              onMarkRead={handleRefresh}
              onMarkUnread={handleRefresh}
              onStatusChange={handleRefresh}
              onDelete={handleRefresh}
            />
          ))
        )}
      </div>
    </div>
  )
}

