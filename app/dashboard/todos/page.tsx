"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { TodoList } from "@/components/todos/TodoList"
import { TodoFilter, TodoFilters } from "@/components/todos/TodoFilter"
import { TodoForm } from "@/components/todos/TodoForm"
import { TodoTimeline } from "@/components/todos/TodoTimeline"
import { TodoTimelineFilters, type TodoTimelineFilters as TodoTimelineFiltersType } from "@/components/todos/TodoTimelineFilters"
import { TodoKanban } from "@/components/todos/TodoKanban"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useRouter } from "next/navigation"

interface Project {
  id: string
  name: string
}

interface Proposal {
  id: string
  title: string
  proposalNumber?: string | null
}

interface Invoice {
  id: string
  invoiceNumber?: string | null
}

interface User {
  id: string
  name: string
  email: string
}

export default function TodosPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [activeTab, setActiveTab] = useState("list")
  const [projects, setProjects] = useState<Project[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [clients, setClients] = useState<Array<{ id: string; name: string; company?: string | null }>>([])
  const [leads, setLeads] = useState<Array<{ id: string; name: string; company?: string | null }>>([])
  // Default filter: all users see all their relevant todos (assigned + created)
  // STAFF users can see todos assigned to them AND todos they created
  const defaultAssignedTo = ""

  const [filters, setFilters] = useState<TodoFilters>({
    projectId: "",
    proposalId: "",
    invoiceId: "",
    clientId: "",
    assignedTo: defaultAssignedTo,
    createdBy: "",
    status: "",
    priority: "",
    read: "",
    hidePersonal: false,
    deadlineFilter: "",
  })

  const [timelineFilters, setTimelineFilters] = useState<TodoTimelineFiltersType>({
    assignedTo: defaultAssignedTo,
    includeCompleted: false,
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [projectsRes, proposalsRes, invoicesRes, usersRes, clientsRes, leadsRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/proposals"),
        fetch("/api/bills"),
        fetch("/api/users"),
        fetch("/api/clients"),
        fetch("/api/leads"),
      ])

      if (projectsRes.ok) {
        const data = await projectsRes.json()
        setProjects(data.map((p: any) => ({ id: p.id, name: p.name, clientId: p.clientId })))
      }
      if (proposalsRes.ok) {
        const data = await proposalsRes.json()
        setProposals(data.map((p: any) => ({ id: p.id, title: p.title, proposalNumber: p.proposalNumber })))
      }
      if (invoicesRes.ok) {
        const data = await invoicesRes.json()
        setInvoices(data.map((i: any) => ({ id: i.id, invoiceNumber: i.invoiceNumber })))
      }
      if (usersRes.ok) {
        const data = await usersRes.json()
        setUsers(data.filter((u: any) => u.role !== "CLIENT"))
      }
      if (clientsRes.ok) {
        const data = await clientsRes.json()
        setClients(data.filter((c: any) => !c.deletedAt && !c.archivedAt).map((c: any) => ({ 
          id: c.id, 
          name: c.name, 
          company: c.company 
        })))
      }
      if (leadsRes.ok) {
        const data = await leadsRes.json()
        setLeads(data.filter((l: any) => !l.deletedAt && !l.archivedAt && l.status !== "CONVERTED").map((l: any) => ({ 
          id: l.id, 
          name: l.name, 
          company: l.company 
        })))
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
    }
  }

  const handleCreateTodo = async (data: any) => {
    try {
      const response = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create ToDo")
      }

      setShowCreateForm(false)
      router.refresh()
    } catch (error: any) {
      throw error
    }
  }

  if (!session) {
    return <div>Please log in to view ToDos.</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">ToDos</h1>
          <p className="text-gray-600 mt-2">Manage your tasks and assignments</p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus className="h-4 w-4 mr-2" />
          {showCreateForm ? "Cancel" : "Create New ToDo"}
        </Button>
      </div>

      {showCreateForm && (
        <div className="mb-6">
          <TodoForm
            projects={projects}
            proposals={proposals}
            invoices={invoices}
            clients={clients}
            leads={leads}
            users={users}
            onSubmit={handleCreateTodo}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <TodoFilter
            projects={projects}
            proposals={proposals}
            invoices={invoices}
            users={users}
            clients={clients}
            onFilterChange={setFilters}
            defaultAssignedTo={defaultAssignedTo}
            initialFilters={filters}
          />
          <TodoList
            currentUserId={session.user.id}
            initialFilters={filters}
            onCreateNew={() => setShowCreateForm(true)}
          />
        </TabsContent>

        <TabsContent value="timeline">
          <TodoTimelineFilters
            projects={projects}
            users={users}
            clients={clients}
            onFilterChange={setTimelineFilters}
            defaultAssignedTo={defaultAssignedTo}
            initialFilters={timelineFilters}
          />
          <TodoTimeline
            initialFilters={timelineFilters}
            currentUserId={session.user.id}
          />
        </TabsContent>

        <TabsContent value="kanban">
          <TodoKanban
            initialFilters={timelineFilters}
            currentUserId={session.user.id}
            users={users}
            defaultAssignedTo={defaultAssignedTo}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

