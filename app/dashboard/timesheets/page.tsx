"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Plus, Clock, DollarSign } from "lucide-react"
import { TimesheetTimeline } from "@/components/timesheets/TimesheetTimeline"
import { TimesheetTimelineFilters, type TimesheetTimelineFilters as TimesheetTimelineFiltersType } from "@/components/timesheets/TimesheetTimelineFilters"
import { TimesheetList } from "@/components/timesheets/TimesheetList"
import { CreateTimesheetEntryForm } from "@/components/timesheets/CreateTimesheetEntryForm"
import { CreateChargeForm } from "@/components/timesheets/CreateChargeForm"
import { LoadingState } from "@/components/shared/LoadingState"

interface Project {
  id: string
  name: string
  clientId?: string
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
  defaultHourlyRate?: number | null
}

export default function TimesheetsPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState("list")
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateTimesheet, setShowCreateTimesheet] = useState(false)
  const [showCreateCharge, setShowCreateCharge] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [timelineFilters, setTimelineFilters] = useState<TimesheetTimelineFiltersType>({
    userId: session?.user.role === "STAFF" ? session.user.id : undefined,
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [projectsRes, clientsRes, usersRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/clients"),
        fetch("/api/users"),
      ])

      // Handle projects response (may be paginated or direct array)
      if (projectsRes.ok) {
        const projectsData = await projectsRes.json()
        const projectsArray = Array.isArray(projectsData) 
          ? projectsData 
          : (projectsData.data && Array.isArray(projectsData.data) ? projectsData.data : [])
        console.log("Fetched projects:", projectsArray.length, "projects")
        const mappedProjects = projectsArray
          .filter((p: any) => p && !p.deletedAt && !p.archivedAt)
          .map((p: any) => ({ 
            id: p.id, 
            name: p.name, 
            clientId: p.clientId || p.client?.id || null
          }))
          .filter((p: any) => p.id) // Ensure we have valid projects
        console.log("Mapped projects with clientId:", mappedProjects.length, "projects")
        setProjects(mappedProjects)
      } else {
        const errorText = await projectsRes.text().catch(() => "Unknown error")
        console.error("Failed to fetch projects:", projectsRes.status, errorText)
        setProjects([])
      }

      // Handle clients response (paginated format)
      if (clientsRes.ok) {
        const clientsData = await clientsRes.json()
        const clientsArray = Array.isArray(clientsData)
          ? clientsData
          : (clientsData.data && Array.isArray(clientsData.data) ? clientsData.data : [])
        console.log("Fetched clients:", clientsArray.length, "clients")
        const filteredClients = clientsArray
          .filter((c: any) => c && !c.deletedAt && !c.archivedAt)
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            company: c.company,
          }))
        console.log("Filtered clients:", filteredClients.length, "clients")
        setClients(filteredClients)
      } else {
        const errorText = await clientsRes.text().catch(() => "Unknown error")
        console.error("Failed to fetch clients:", clientsRes.status, errorText)
        setClients([])
      }

      // Handle users response (direct array)
      if (usersRes.ok) {
        const usersData = await usersRes.json()
        const usersArray = Array.isArray(usersData) ? usersData : []
        console.log("Fetched users:", usersArray.length, "users")
        const filteredUsers = usersArray
          .filter((u: any) => u && u.role !== "CLIENT")
          .map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            defaultHourlyRate: u.defaultHourlyRate,
          }))
        console.log("Filtered users (non-CLIENT):", filteredUsers.length, "users")
        setUsers(filteredUsers)
      } else {
        const errorText = await usersRes.text().catch(() => "Unknown error")
        console.error("Failed to fetch users:", usersRes.status, errorText)
        setUsers([])
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
      setProjects([])
      setClients([])
      setUsers([])
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
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex gap-2">
              <Button onClick={() => setShowCreateTimesheet(true)}>
                <Clock className="h-4 w-4 mr-2" />
                Create Timesheet Entry
              </Button>
              <Button onClick={() => setShowCreateCharge(true)} variant="outline">
                <DollarSign className="h-4 w-4 mr-2" />
                Create Charge
              </Button>
            </div>
          </div>
          <TimesheetTimelineFilters
            users={users}
            projects={projects}
            clients={clients}
            onFilterChange={setTimelineFilters}
            currentUserId={session.user.id}
            userRole={session.user.role}
            initialFilters={timelineFilters}
          />
          <TimesheetList
            key={refreshKey}
            initialFilters={timelineFilters}
            currentUserId={session.user.id}
            userRole={session.user.role}
          />
        </TabsContent>

        <TabsContent value="timeline">
          <TimesheetTimelineFilters
            users={users}
            projects={projects}
            clients={clients}
            onFilterChange={setTimelineFilters}
            currentUserId={session.user.id}
            userRole={session.user.role}
            initialFilters={timelineFilters}
          />
          <TimesheetTimeline
            key={refreshKey}
            initialFilters={timelineFilters}
            currentUserId={session.user.id}
            userRole={session.user.role}
          />
        </TabsContent>
      </Tabs>

      <CreateTimesheetEntryForm
        projects={projects}
        users={users}
        isOpen={showCreateTimesheet}
        onClose={() => setShowCreateTimesheet(false)}
        onSuccess={() => {
          setRefreshKey((prev) => prev + 1)
          setShowCreateTimesheet(false)
        }}
      />

      <CreateChargeForm
        projects={projects}
        isOpen={showCreateCharge}
        onClose={() => setShowCreateCharge(false)}
        onSuccess={() => {
          setRefreshKey((prev) => prev + 1)
          setShowCreateCharge(false)
        }}
      />
    </div>
  )
}
