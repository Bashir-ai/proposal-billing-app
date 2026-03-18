"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { TodoList } from "@/components/todos/TodoList"
import { TodoForm } from "@/components/todos/TodoForm"
import { useSession } from "next-auth/react"

interface ProjectTodosSectionProps {
  projectId: string
}

export function ProjectTodosSection({ projectId }: ProjectTodosSectionProps) {
  const { data: session } = useSession()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users")
      if (response.ok) {
        const data = await response.json()
        setUsers(data.filter((user: any) => user.role !== "CLIENT"))
      }
    } catch (error) {
      console.error("Failed to fetch users:", error)
    }
  }

  const handleCreateTodo = async (data: any) => {
    try {
      const response = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          projectId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create todo")
      }

      setShowCreateForm(false)
      window.location.reload()
    } catch (error: any) {
      throw error
    }
  }

  if (!session) {
    return null
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Tasks & Todos</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            <Plus className="h-4 w-4 mr-2" />
            {showCreateForm ? "Cancel" : "Create Task"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showCreateForm && (
          <div className="mb-6">
            <TodoForm
              projects={[{ id: projectId, name: "" }]}
              proposals={[]}
              invoices={[]}
              users={users}
              onSubmit={handleCreateTodo}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        )}

        <TodoList
          currentUserId={session.user.id}
          initialFilters={{ projectId }}
        />
      </CardContent>
    </Card>
  )
}






