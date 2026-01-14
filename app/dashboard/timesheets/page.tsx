"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { TimesheetTimeline } from "@/components/timesheets/TimesheetTimeline"
import { TimesheetTimelineFilters } from "@/components/timesheets/TimesheetTimelineFilters"
import { LoadingState } from "@/components/shared/LoadingState"

interface Project {
  id: string
  name: string
}

interface Client {
  id: string
  name: string
  company?: string | null
}

interface User {
  id: string
  name: string
  email: string
}

export default function TimesheetsPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState("timeline")
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [timelineFilters, setTimelineFilters] = useState({
    userId: session?.user.role === "STAFF" ? session.user.id : undefined,
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [projectsRes, clientsRes, usersRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/clients"),
        fetch("/api/users"),
      ])

      if (projectsRes.ok) {
        const data = await projectsRes.json()
        setProjects(data.map((p: any) => ({ id: p.id, name: p.name })))
      }
      if (clientsRes.ok) {
        const data = await clientsRes.json()
        setClients(
          data
            .filter((c: any) => !c.deletedAt && !c.archivedAt)
            .map((c: any) => ({
              id: c.id,
              name: c.name,
              company: c.company,
            }))
        )
      }
      if (usersRes.ok) {
        const data = await usersRes.json()
        setUsers(data.filter((u: any) => u.role !== "CLIENT"))
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }

  if (!session) {
    return <div>Please log in to view timesheets.</div>
  }

  if (loading) {
    return <LoadingState message="Loading timesheets..." variant="spinner" />
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Timesheets & Charges</h1>
        <p className="text-gray-600 mt-2">View and manage timesheet entries and charges</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <TimesheetTimelineFilters
            users={users}
            projects={projects}
            clients={clients}
            onFilterChange={setTimelineFilters}
            currentUserId={session.user.id}
            userRole={session.user.role}
          />
          <TimesheetTimeline
            initialFilters={timelineFilters}
            currentUserId={session.user.id}
            userRole={session.user.role}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
