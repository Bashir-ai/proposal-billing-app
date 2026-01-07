"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface QuickTodoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickTodoDialog({ open, onOpenChange }: QuickTodoDialogProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [clients, setClients] = useState<Array<{ id: string; name: string; company?: string | null }>>([])
  const [leads, setLeads] = useState<Array<{ id: string; name: string; company?: string | null }>>([])
  const [projects, setProjects] = useState<Array<{ id: string; name: string; clientId: string }>>([])
  const [filteredProjects, setFilteredProjects] = useState<Array<{ id: string; name: string; clientId: string }>>([])
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assignedTo: "",
    priority: "MEDIUM",
    dueDate: "",
    clientId: "",
    leadId: "",
    projectId: "",
  })

  // Fetch users, clients, and projects when dialog opens
  useEffect(() => {
    if (open) {
      // Fetch users
      if (users.length === 0) {
        fetch("/api/users")
          .then((res) => res.json())
          .then((data) => {
            setUsers(data.filter((u: any) => u.role !== "CLIENT"))
            if (session?.user.id) {
              setFormData((prev) => ({ ...prev, assignedTo: session.user.id }))
            }
          })
          .catch(console.error)
      }

      // Fetch clients
      if (clients.length === 0) {
        fetch("/api/clients")
          .then((res) => res.json())
          .then((data) => {
            setClients(data.filter((c: any) => !c.deletedAt && !c.archivedAt))
          })
          .catch(console.error)
      }

      // Fetch leads
      if (leads.length === 0) {
        fetch("/api/leads")
          .then((res) => res.json())
          .then((data) => {
            setLeads(data.filter((l: any) => !l.deletedAt && !l.archivedAt && l.status !== "CONVERTED"))
          })
          .catch(console.error)
      }

      // Fetch projects
      if (projects.length === 0) {
        fetch("/api/projects")
          .then((res) => res.json())
          .then((data) => {
            const activeProjects = data.filter((p: any) => !p.deletedAt)
            setProjects(activeProjects)
            setFilteredProjects(activeProjects)
          })
          .catch(console.error)
      }
    }
  }, [open, users.length, clients.length, leads.length, projects.length, session?.user.id])

  // Filter projects when client is selected
  useEffect(() => {
    if (formData.clientId) {
      const filtered = projects.filter((p) => p.clientId === formData.clientId)
      setFilteredProjects(filtered)
      // Clear project selection if it doesn't belong to selected client
      if (formData.projectId) {
        const selectedProject = projects.find((p) => p.id === formData.projectId)
        if (selectedProject && selectedProject.clientId !== formData.clientId) {
          setFormData((prev) => ({ ...prev, projectId: "" }))
        }
      }
    } else {
      setFilteredProjects(projects)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.clientId, formData.leadId, projects])

  // Auto-set client when project is selected
  useEffect(() => {
    if (formData.projectId && !formData.clientId) {
      const selectedProject = projects.find((p) => p.id === formData.projectId)
      if (selectedProject) {
        setFormData((prev) => ({ ...prev, clientId: selectedProject.clientId }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.projectId, projects])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          assignedTo: formData.assignedTo || session?.user.id,
          priority: formData.priority,
          dueDate: formData.dueDate || null,
          clientId: formData.clientId || null,
          leadId: formData.leadId || null,
          projectId: formData.projectId || null,
          isPersonal: false,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Failed to create todo")
      } else {
        // Reset form
        setFormData({
          title: "",
          description: "",
          assignedTo: session?.user.id || "",
          priority: "MEDIUM",
          dueDate: "",
    clientId: "",
    leadId: "",
    projectId: "",
  })
        onOpenChange(false)
        router.refresh()
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Quick Create Todo</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientId">Client (Optional)</Label>
              <Select
                id="clientId"
                value={formData.clientId}
                onChange={(e) => {
                  const newClientId = e.target.value
                  setFormData({ 
                    ...formData, 
                    clientId: newClientId, 
                    leadId: "", // Clear lead when client is selected
                    projectId: "" 
                  })
                }}
              >
                <option value="">No client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} {client.company ? `(${client.company})` : ""}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="leadId">Lead (Optional)</Label>
              <Select
                id="leadId"
                value={formData.leadId}
                onChange={(e) => {
                  const newLeadId = e.target.value
                  setFormData({ 
                    ...formData, 
                    leadId: newLeadId,
                    clientId: "", // Clear client when lead is selected
                    projectId: "" // Clear project when lead is selected
                  })
                }}
                disabled={!!formData.clientId}
              >
                <option value="">No lead</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name} {lead.company ? `(${lead.company})` : ""}
                  </option>
                ))}
              </Select>
              {formData.clientId && (
                <p className="text-sm text-gray-500">Select either Client or Lead, not both</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="projectId">Project (Optional)</Label>
              <Select
                id="projectId"
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                disabled={formData.clientId && filteredProjects.length === 0 || !!formData.leadId}
              >
                <option value="">No project</option>
                {filteredProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
              {formData.clientId && filteredProjects.length === 0 && (
                <p className="text-sm text-gray-500">No projects found for this client</p>
              )}
              {formData.leadId && (
                <p className="text-sm text-gray-500">Projects can only be selected when a Client is selected</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignedTo">Assign To *</Label>
              <Select
                id="assignedTo"
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                required
              >
                <option value="">Select a user...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  id="priority"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}

            <div className="flex space-x-4 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Creating..." : "Create Todo"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

