"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { TodoForm } from "@/components/todos/TodoForm"
import { TodoReassignmentHistory } from "@/components/todos/TodoReassignmentHistory"
import { TodoDueDateChangeHistory } from "@/components/todos/TodoDueDateChangeHistory"
import { TodoComments } from "@/components/todos/TodoComments"
import { useSession } from "next-auth/react"

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

interface ProposalItem {
  id: string
  description: string
}

export default function EditTodoPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const id = params.id as string
  
  const [todo, setTodo] = useState<any>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [proposalItems, setProposalItems] = useState<ProposalItem[]>([])
  const [clients, setClients] = useState<Array<{ id: string; name: string; company?: string | null }>>([])
  const [leads, setLeads] = useState<Array<{ id: string; name: string; company?: string | null }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const fetchData = async () => {
    try {
      // Fetch todo
      const todoRes = await fetch(`/api/todos/${id}`)
      if (!todoRes.ok) {
        router.push("/dashboard/todos")
        return
      }
      const todoData = await todoRes.json()
      setTodo(todoData)

      // Fetch related data
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
        const projectsData = data.data && data.pagination ? data.data : data
        setProjects(projectsData.map((p: any) => ({ id: p.id, name: p.name, clientId: p.clientId })))
      }
      if (proposalsRes.ok) {
        const data = await proposalsRes.json()
        const proposalsData = data.data && data.pagination ? data.data : data
        setProposals(proposalsData.map((p: any) => ({ id: p.id, title: p.title, proposalNumber: p.proposalNumber })))
      }
      if (invoicesRes.ok) {
        const data = await invoicesRes.json()
        const invoicesData = data.data && data.pagination ? data.data : data
        setInvoices(invoicesData.map((i: any) => ({ id: i.id, invoiceNumber: i.invoiceNumber })))
      }
      if (usersRes.ok) {
        const data = await usersRes.json()
        setUsers(data.filter((u: any) => u.role !== "CLIENT"))
      }
      if (clientsRes.ok) {
        const data = await clientsRes.json()
        const clientsData = data.data && data.pagination ? data.data : data
        setClients(clientsData.filter((c: any) => !c.deletedAt && !c.archivedAt).map((c: any) => ({ 
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

      // Fetch proposal items if todo has a proposal
      if (todoData.proposalId) {
        const proposalRes = await fetch(`/api/proposals/${todoData.proposalId}`)
        if (proposalRes.ok) {
          const proposalData = await proposalRes.json()
          setProposalItems(proposalData.items?.map((item: any) => ({
            id: item.id,
            description: item.description,
          })) || [])
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (data: any) => {
    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update ToDo")
      }

      router.push("/dashboard/todos")
    } catch (error: any) {
      throw error
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (!todo) {
    return <div>ToDo not found</div>
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit ToDo</h1>
        <p className="text-gray-600 mt-2">Update task details</p>
      </div>

      <TodoForm
        initialData={{
          id: todo.id,
          title: todo.title,
          description: todo.description || undefined,
          projectId: todo.projectId || undefined,
          proposalId: todo.proposalId || undefined,
          proposalItemId: todo.proposalItemId || undefined,
          invoiceId: todo.invoiceId || undefined,
          clientId: todo.clientId || undefined,
          leadId: todo.leadId || undefined,
          assignedTo: todo.assignedTo,
          assignments: todo.assignments || undefined,
          priority: todo.priority,
          isPersonal: todo.isPersonal || false,
          startDate: todo.startDate ? new Date(todo.startDate).toISOString().split("T")[0] : undefined,
          estimatedEndDate: todo.estimatedEndDate ? new Date(todo.estimatedEndDate).toISOString().split("T")[0] : undefined,
          dueDate: todo.dueDate ? new Date(todo.dueDate).toISOString().split("T")[0] : undefined,
        }}
        projects={projects}
        proposals={proposals}
        proposalItems={proposalItems}
        invoices={invoices}
        clients={clients}
        leads={leads}
        users={users}
        creator={todo.creator}
        currentAssignee={todo.assignee}
        currentUser={session?.user}
        onSubmit={handleSubmit}
        onCancel={() => router.push("/dashboard/todos")}
      />
      
      {todo.reassignments && todo.reassignments.length > 0 && (
        <div className="mt-6">
          <TodoReassignmentHistory reassignments={todo.reassignments} />
        </div>
      )}
      
      {todo.dueDateChanges && todo.dueDateChanges.length > 0 && (
        <div className="mt-6">
          <TodoDueDateChangeHistory dueDateChanges={todo.dueDateChanges} />
        </div>
      )}

      <div className="mt-6">
        <TodoComments todoId={todo.id} />
      </div>
    </div>
  )
}

