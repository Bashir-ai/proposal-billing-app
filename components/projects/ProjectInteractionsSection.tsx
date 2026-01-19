"use client"

import { useState, useEffect } from "react"
import { ProjectInteractionTimeline } from "./ProjectInteractionTimeline"
import { QuickProjectInteractionButton } from "./QuickProjectInteractionButton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ProjectInteraction {
  id: string
  interactionType: string
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

interface ProjectInteractionsSectionProps {
  projectId: string
  initialInteractions?: ProjectInteraction[]
}

export function ProjectInteractionsSection({ projectId, initialInteractions = [] }: ProjectInteractionsSectionProps) {
  const [interactions, setInteractions] = useState<ProjectInteraction[]>(initialInteractions)
  const [loading, setLoading] = useState(false)

  const fetchInteractions = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/interactions`)
      if (response.ok) {
        const data = await response.json()
        setInteractions(data)
      }
    } catch (error) {
      console.error("Error fetching interactions:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialInteractions.length === 0) {
      fetchInteractions()
    }
  }, [projectId])

  const handleInteractionCreated = () => {
    fetchInteractions()
  }

  return (
    <div className="space-y-4 mb-8">
      <Card>
        <CardHeader>
          <CardTitle>Project Status & Updates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            <QuickProjectInteractionButton
              projectId={projectId}
              interactionType="STATUS_UPDATE"
              label="Status Update"
              onInteractionCreated={handleInteractionCreated}
            />
            <QuickProjectInteractionButton
              projectId={projectId}
              interactionType="MILESTONE_REACHED"
              label="Milestone Reached"
              onInteractionCreated={handleInteractionCreated}
            />
            <QuickProjectInteractionButton
              projectId={projectId}
              interactionType="NOTE"
              label="Add Note"
              onInteractionCreated={handleInteractionCreated}
            />
            <QuickProjectInteractionButton
              projectId={projectId}
              interactionType="MEETING"
              label="Log Meeting"
              onInteractionCreated={handleInteractionCreated}
            />
            <QuickProjectInteractionButton
              projectId={projectId}
              interactionType="PHONE_CALL"
              label="Phone Call"
              onInteractionCreated={handleInteractionCreated}
            />
            <QuickProjectInteractionButton
              projectId={projectId}
              interactionType="EMAIL"
              label="Email Sent"
              onInteractionCreated={handleInteractionCreated}
            />
          </div>
        </CardContent>
      </Card>

      <ProjectInteractionTimeline interactions={interactions} />
    </div>
  )
}
