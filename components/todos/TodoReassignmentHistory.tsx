"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/utils"
import { ArrowRight } from "lucide-react"

interface Reassignment {
  id: string
  fromUser: {
    name: string
    email: string
  }
  toUser: {
    name: string
    email: string
  }
  reassignedByUser: {
    name: string
    email: string
  }
  reason?: string | null
  createdAt: string
}

interface TodoReassignmentHistoryProps {
  reassignments: Reassignment[]
}

export function TodoReassignmentHistory({ reassignments }: TodoReassignmentHistoryProps) {
  if (reassignments.length === 0) {
    return null
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg">Reassignment History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {reassignments.map((reassignment) => (
            <div key={reassignment.id} className="border-l-2 border-gray-200 pl-4 py-2">
              <div className="flex items-center space-x-2 text-sm">
                <span className="font-medium text-gray-700">{reassignment.fromUser.name}</span>
                <ArrowRight className="h-4 w-4 text-gray-400" />
                <span className="font-medium text-gray-700">{reassignment.toUser.name}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Reassigned by {reassignment.reassignedByUser.name} on {formatDate(reassignment.createdAt)}
              </div>
              {reassignment.reason && (
                <div className="text-sm text-gray-600 mt-2 italic">
                  Reason: {reassignment.reason}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}





