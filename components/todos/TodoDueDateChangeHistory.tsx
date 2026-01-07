"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/utils"
import { Calendar } from "lucide-react"

interface DueDateChange {
  id: string
  oldDueDate: string | null
  newDueDate: string | null
  changedByUser: {
    name: string
    email: string
  }
  reason?: string | null
  createdAt: string
}

interface TodoDueDateChangeHistoryProps {
  dueDateChanges: DueDateChange[]
}

export function TodoDueDateChangeHistory({ dueDateChanges }: TodoDueDateChangeHistoryProps) {
  if (dueDateChanges.length === 0) {
    return null
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg">Due Date Change History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {dueDateChanges.map((change) => (
            <div key={change.id} className="border-l-2 border-gray-200 pl-4 py-2">
              <div className="flex items-center space-x-2 text-sm">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">
                  {change.oldDueDate ? formatDate(change.oldDueDate) : "No due date"}
                </span>
                <span className="text-gray-400">→</span>
                <span className="font-medium text-gray-700">
                  {change.newDueDate ? formatDate(change.newDueDate) : "No due date"}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Changed by {change.changedByUser.name} on {formatDate(change.createdAt)}
              </div>
              {change.reason && (
                <div className="text-sm text-gray-600 mt-2 italic">
                  Reason: {change.reason}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}





