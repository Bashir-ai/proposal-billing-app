"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import { TodoPriority, TodoStatus } from "@prisma/client"
import { cn } from "@/lib/utils"
import { AlertCircle } from "lucide-react"

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

interface TodoKanbanCardProps {
  todo: Todo
  onDragStart: (e: React.DragEvent, todo: Todo) => void
  onDragEnd: (e: React.DragEvent) => void
  onClick?: () => void
}

export function TodoKanbanCard({ todo, onDragStart, onDragEnd, onClick }: TodoKanbanCardProps) {
  const isOverdue = todo.dueDate && new Date(todo.dueDate) < new Date() && todo.status !== TodoStatus.COMPLETED

  const getPriorityColor = (priority: TodoPriority) => {
    switch (priority) {
      case "HIGH":
        return "bg-red-500"
      case "MEDIUM":
        return "bg-yellow-500"
      case "LOW":
        return "bg-green-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, todo)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "cursor-move hover:shadow-md transition-shadow mb-2",
        isOverdue && "border-red-500 border-2"
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-medium text-sm flex-1">{todo.title}</h4>
          <div className={cn("w-2 h-2 rounded-full ml-2", getPriorityColor(todo.priority))} />
        </div>

        {todo.description && (
          <p className="text-xs text-gray-600 mb-2 line-clamp-2">{todo.description}</p>
        )}

        {todo.project && (
          <div className="mb-2">
            <Badge variant="outline" className="text-xs">
              {todo.project.name}
            </Badge>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500">
          {todo.assignee ? (
            <span className="truncate">{todo.assignee.name}</span>
          ) : (
            <span className="text-gray-400">Unassigned</span>
          )}
          {todo.dueDate && (
            <div className="flex items-center gap-1">
              {isOverdue && <AlertCircle className="h-3 w-3 text-red-500" />}
              <span className={cn(isOverdue && "text-red-600 font-semibold")}>
                {formatDate(todo.dueDate)}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
