"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// Format date helper
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
import { CheckCircle2, Users, Phone, Mail, FileText, MessageSquare, MoreHorizontal, Target, Lock } from "lucide-react"

interface ProjectInteraction {
  id: string
  interactionType: string // "STATUS_UPDATE", "MILESTONE_REACHED", "NOTE", "MEETING", "PHONE_CALL", "EMAIL", etc.
  title: string | null
  notes: string | null
  date: string
  createdAt: string
  creator: {
    id: string
    name: string
    email: string
  }
}

interface ProjectInteractionTimelineProps {
  interactions: ProjectInteraction[]
}

const getInteractionIcon = (type: string) => {
  switch (type) {
    case "STATUS_UPDATE":
      return <CheckCircle2 className="h-4 w-4" />
    case "MILESTONE_REACHED":
      return <Target className="h-4 w-4" />
    case "MEETING":
      return <Users className="h-4 w-4" />
    case "PHONE_CALL":
      return <Phone className="h-4 w-4" />
    case "EMAIL":
      return <Mail className="h-4 w-4" />
    case "NOTE":
      return <MessageSquare className="h-4 w-4" />
    case "INTERNAL_COMMENT":
      return <Lock className="h-4 w-4" />
    default:
      return <MoreHorizontal className="h-4 w-4" />
  }
}

const getInteractionLabel = (type: string) => {
  return type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
}

export function ProjectInteractionTimeline({ interactions }: ProjectInteractionTimelineProps) {
  if (interactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Project Status & Updates</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-4">No updates yet. Add an update to track project progress.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Status & Updates</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {interactions.map((interaction) => {
            const isInternalComment = interaction.interactionType === "INTERNAL_COMMENT"
            
            return (
              <div
                key={interaction.id}
                className={`flex items-start space-x-4 pb-4 border-b last:border-b-0 last:pb-0 ${isInternalComment ? 'bg-amber-50 p-3 rounded-lg border-amber-200' : ''}`}
              >
                <div className="flex-shrink-0 mt-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isInternalComment ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-600'}`}>
                    {getInteractionIcon(interaction.interactionType)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">
                          {interaction.title || getInteractionLabel(interaction.interactionType)}
                        </p>
                        {isInternalComment && (
                          <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full font-medium" title="Internal - Only visible to assigned users">
                            Internal
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        by {interaction.creator.name} on {formatDate(interaction.date)}
                      </p>
                    </div>
                  </div>
                  {interaction.notes && (
                    <p className="text-sm text-gray-700 mt-2">{interaction.notes}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
