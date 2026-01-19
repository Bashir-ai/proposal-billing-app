"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { InteractionType } from "@prisma/client"
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
import { Mail, MapPin, Users, FileText, ClipboardList, Phone, MoreHorizontal, Pencil } from "lucide-react"
import { EditInteractionForm } from "./EditInteractionForm"

interface LeadInteraction {
  id: string
  interactionType: InteractionType
  notes: string | null
  date: string
  createdAt: string
  creator: {
    id: string
    name: string
    email: string
  }
}

interface LeadInteractionTimelineProps {
  interactions: LeadInteraction[]
  currentUserId: string
  leadId: string
  onInteractionUpdated: () => void
}

const getInteractionIcon = (type: InteractionType) => {
  switch (type) {
    case "EMAIL_SENT":
      return <Mail className="h-4 w-4" />
    case "VISIT":
      return <MapPin className="h-4 w-4" />
    case "MEETING":
      return <Users className="h-4 w-4" />
    case "PROPOSAL_SENT":
      return <FileText className="h-4 w-4" />
    case "QUESTIONNAIRE_SENT":
      return <ClipboardList className="h-4 w-4" />
    case "PHONE_CALL":
      return <Phone className="h-4 w-4" />
    default:
      return <MoreHorizontal className="h-4 w-4" />
  }
}

const getInteractionLabel = (type: InteractionType) => {
  return type.replace("_", " ")
}

export function LeadInteractionTimeline({ interactions, currentUserId, leadId, onInteractionUpdated }: LeadInteractionTimelineProps) {
  const [editingInteractionId, setEditingInteractionId] = useState<string | null>(null)

  if (interactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Interaction Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-4">No interactions yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Interaction Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {interactions.map((interaction) => {
            const isOwnInteraction = interaction.creator.id === currentUserId
            const isEditing = editingInteractionId === interaction.id

            if (isEditing) {
              return (
                <EditInteractionForm
                  key={interaction.id}
                  leadId={leadId}
                  interaction={interaction}
                  onSuccess={() => {
                    setEditingInteractionId(null)
                    onInteractionUpdated()
                  }}
                  onCancel={() => setEditingInteractionId(null)}
                />
              )
            }

            return (
              <div
                key={interaction.id}
                className="flex items-start space-x-4 pb-4 border-b last:border-b-0 last:pb-0"
              >
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    {getInteractionIcon(interaction.interactionType)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {getInteractionLabel(interaction.interactionType)}
                      </p>
                      <p className="text-xs text-gray-500">
                        by {interaction.creator.name} on {formatDate(interaction.date)}
                      </p>
                    </div>
                    {isOwnInteraction && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingInteractionId(interaction.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
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

