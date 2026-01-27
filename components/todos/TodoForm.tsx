"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { formatClientName } from "@/lib/utils"

interface TodoFormProps {
  initialData?: {
    id?: string
    title?: string
    description?: string
    projectId?: string
    proposalId?: string
    proposalItemId?: string
    invoiceId?: string
    clientId?: string
    leadId?: string
    assignedTo?: string
    assignments?: Array<{ user?: { id: string }; userId?: string }>
    priority?: string
    isPersonal?: boolean
    startDate?: string
    estimatedEndDate?: string
    dueDate?: string
  }
  projects?: Array<{ id: string; name: string; clientId?: string }>
  proposals?: Array<{ id: string; title: string; proposalNumber?: string | null }>
  proposalItems?: Array<{ id: string; description: string }>
  invoices?: Array<{ id: string; invoiceNumber?: string | null }>
  clients?: Array<{ id: string; name: string; clientCode?: number | null; company?: string | null }>
  leads?: Array<{ id: string; name: string; company?: string | null }>
  users?: Array<{ id: string; name: string; email: string; role?: string }>
  creator?: { id: string; role: string }
  currentAssignee?: { id: string; role: string }
  currentUser?: { id: string; role: string }
  onSubmit: (data: any) => Promise<void>
  onCancel?: () => void
}

export function TodoForm({
  initialData,
  projects = [],
  proposals = [],
  proposalItems = [],
  invoices = [],
  clients = [],
  leads = [],
  users = [],
  creator,
  currentAssignee,
  currentUser,
  onSubmit,
  onCancel,
}: TodoFormProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [reassignmentReason, setReassignmentReason] = useState("")
  const [dueDateChangeReason, setDueDateChangeReason] = useState("")
  // Get initial assigned users from assignments if available, otherwise from assignedTo
  const getInitialAssignedUsers = () => {
    if (initialData?.assignments && Array.isArray(initialData.assignments) && initialData.assignments.length > 0) {
      return initialData.assignments.map((a: any) => a.user?.id || a.userId).filter(Boolean)
    }
    if (initialData?.assignedTo) {
      return [initialData.assignedTo]
    }
    return []
  }

  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    description: initialData?.description || "",
    projectId: initialData?.projectId || "",
    proposalId: initialData?.proposalId || "",
    proposalItemId: initialData?.proposalItemId || "",
    invoiceId: initialData?.invoiceId || "",
    clientId: initialData?.clientId || "",
    leadId: initialData?.leadId || "",
    assignedTo: initialData?.assignedTo || "", // Keep for backward compatibility
    assignedUsers: getInitialAssignedUsers(), // New: array of user IDs
    priority: initialData?.priority || "MEDIUM",
    isPersonal: initialData?.isPersonal || false,
    startDate: initialData?.startDate ? new Date(initialData.startDate).toISOString().split("T")[0] : "",
    estimatedEndDate: initialData?.estimatedEndDate ? new Date(initialData.estimatedEndDate).toISOString().split("T")[0] : "",
    dueDate: initialData?.dueDate ? new Date(initialData.dueDate).toISOString().split("T")[0] : "",
  })

  const [filteredProjects, setFilteredProjects] = useState(projects)
  const [projectSearchTerm, setProjectSearchTerm] = useState("")
  const [filteredProposals, setFilteredProposals] = useState(proposals)
  const [filteredInvoices, setFilteredInvoices] = useState(invoices)

  // Check if reassignment is allowed
  const canReassign = creator && currentAssignee && currentUser && 
    (currentUser.role === "ADMIN" || 
     creator.id === currentUser.id ||
     (currentUser.id === currentAssignee.id && 
      ((creator.role === "ADMIN" && currentAssignee.role !== "ADMIN") ||
       (creator.role === "MANAGER" && (currentAssignee.role === "STAFF" || currentAssignee.role === "CLIENT")))))
  
  const isReassigning = initialData?.id && formData.assignedTo !== initialData.assignedTo && canReassign

  const [filteredProposalItems, setFilteredProposalItems] = useState(proposalItems)

  // Filter projects when client is selected and apply search
  useEffect(() => {
    let filtered = projects
    // Filter by client first
    if (formData.clientId) {
      filtered = filtered.filter((p) => p.clientId === formData.clientId)
      // Clear project selection if it doesn't belong to selected client
      if (formData.projectId) {
        const selectedProject = projects.find((p) => p.id === formData.projectId)
        if (selectedProject && selectedProject.clientId !== formData.clientId) {
          setFormData((prev) => ({ ...prev, projectId: "", proposalId: "", proposalItemId: "", invoiceId: "" }))
        }
      }
    }
    // Apply search filter
    if (projectSearchTerm) {
      filtered = filtered.filter((p) => 
        p.name.toLowerCase().includes(projectSearchTerm.toLowerCase())
      )
    }
    setFilteredProjects(filtered)
  }, [formData.clientId, projects, formData.projectId, projectSearchTerm])

  // Auto-set client when project is selected
  useEffect(() => {
    if (formData.projectId && !formData.clientId) {
      const selectedProject = projects.find((p) => p.id === formData.projectId)
      if (selectedProject && selectedProject.clientId) {
        const newClientId = selectedProject.clientId
        setFormData((prev) => ({ ...prev, clientId: newClientId }))
      }
    }
  }, [formData.projectId, projects, formData.clientId])

  // Filter proposals and invoices based on selected project
  useEffect(() => {
    if (formData.projectId) {
      // Fetch project details to get proposalId
      fetch(`/api/projects/${formData.projectId}`)
        .then((res) => res.json())
        .then((data) => {
          // Filter proposals to only the project's proposal
          if (data.proposalId) {
            const projectProposal = proposals.find(p => p.id === data.proposalId)
            setFilteredProposals(projectProposal ? [projectProposal] : [])
            // Auto-select the proposal if it exists and is different from current selection
            // Only update if the current proposal doesn't match the project's proposal
            setFormData((prev) => {
              if (projectProposal && prev.proposalId !== data.proposalId) {
                return { ...prev, proposalId: projectProposal.id }
              }
              return prev
            })
          } else {
            setFilteredProposals([])
            // Clear proposal selection if project has no proposal
            setFormData((prev) => {
              if (prev.proposalId) {
                return { ...prev, proposalId: "", proposalItemId: "" }
              }
              return prev
            })
          }
          // Filter invoices to only project invoices
          // Note: invoices should already be filtered by project in the parent component
          // but we'll ensure they match the project
          setFilteredInvoices(invoices.filter((inv: any) => inv.projectId === formData.projectId))
        })
        .catch((error) => {
          console.error("Failed to fetch project:", error)
          setFilteredProposals(proposals)
          setFilteredInvoices(invoices)
        })
    } else {
      setFilteredProposals(proposals)
      setFilteredInvoices(invoices)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.projectId, proposals, invoices])

  useEffect(() => {
    if (formData.proposalId) {
      // Fetch proposal items for the selected proposal
      fetch(`/api/proposals/${formData.proposalId}`)
        .then((res) => res.json())
        .then((data) => {
          setFilteredProposalItems(
            data.items?.map((item: any) => ({
              id: item.id,
              description: item.description,
            })) || []
          )
        })
        .catch((error) => {
          console.error("Failed to fetch proposal items:", error)
          setFilteredProposalItems([])
        })
    } else {
      setFilteredProposalItems([])
    }
  }, [formData.proposalId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (!formData.title.trim()) {
        setError("Title is required")
        return
      }
      // If personal, automatically set assignedTo to current user
      if (formData.isPersonal && session?.user?.id) {
        formData.assignedTo = session.user.id
      }

      if (!formData.isPersonal && !formData.assignedTo) {
        setError("Assignee is required for non-personal ToDos")
        return
      }

      // Check if due date is being changed by assignee
      const isDueDateChanging = initialData?.id && 
        formData.dueDate !== (initialData.dueDate ? new Date(initialData.dueDate).toISOString().split("T")[0] : "")
      // Check if user is assigned (via assignments or assignedTo)
      const assignedUserIds = initialData?.assignments 
        ? initialData.assignments.map((a: any) => a.user?.id || a.userId).filter(Boolean)
        : (initialData?.assignedTo ? [initialData.assignedTo] : [])
      const isAssignee = assignedUserIds.includes(session?.user?.id || "")

      await onSubmit({
        ...formData,
        projectId: formData.projectId || undefined,
        proposalId: formData.proposalId || undefined,
        proposalItemId: formData.proposalItemId || undefined,
        invoiceId: formData.invoiceId || undefined,
        clientId: formData.clientId || undefined,
        leadId: formData.leadId || undefined,
        assignedTo: formData.isPersonal 
          ? session?.user?.id 
          : (formData.assignedUsers.length > 0 ? formData.assignedUsers : (formData.assignedTo ? [formData.assignedTo] : [session?.user?.id])),
        startDate: formData.startDate || undefined,
        estimatedEndDate: formData.estimatedEndDate || undefined,
        dueDate: formData.dueDate || undefined,
        reassignmentReason: isReassigning ? reassignmentReason : undefined,
        dueDateChangeReason: isDueDateChanging && isAssignee ? dueDateChangeReason : undefined,
      })
    } catch (err: any) {
        setError(err.message || "Failed to save ToDo")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData?.id ? "Edit ToDo" : "Create ToDo"}</CardTitle>
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
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isPersonal"
                checked={formData.isPersonal}
                onChange={(e) => {
                  const isPersonal = e.target.checked
                  setFormData({
                    ...formData,
                    isPersonal,
                    assignedTo: isPersonal && session?.user?.id ? session.user.id : formData.assignedTo,
                  })
                }}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="isPersonal" className="font-medium">
                Personal/Private ToDo
              </Label>
            </div>
            {formData.isPersonal && (
              <p className="text-xs text-gray-600 ml-6">
                This ToDo will be hidden from other users and can only be seen by you.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assignedUsers">Assign To *</Label>
              <div className="space-y-2">
                <Select
                  id="assignedUsers"
                  multiple
                  value={formData.assignedUsers}
                  onChange={(e) => {
                    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value)
                    setFormData({ 
                      ...formData, 
                      assignedUsers: selectedOptions,
                      assignedTo: selectedOptions[0] || "", // Keep first for backward compatibility
                    })
                  }}
                  required={!formData.isPersonal && formData.assignedUsers.length === 0}
                  disabled={formData.isPersonal}
                  className="min-h-[100px]"
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </Select>
                {formData.assignedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.assignedUsers.map((userId) => {
                      const user = users.find(u => u.id === userId)
                      return user ? (
                        <span
                          key={userId}
                          className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm flex items-center gap-1"
                        >
                          {user.name}
                          <button
                            type="button"
                            onClick={() => {
                              const newUsers = formData.assignedUsers.filter(id => id !== userId)
                              setFormData({ 
                                ...formData, 
                                assignedUsers: newUsers,
                                assignedTo: newUsers[0] || "",
                              })
                            }}
                            className="text-blue-600 hover:text-blue-800"
                            disabled={formData.isPersonal}
                          >
                            ×
                          </button>
                        </span>
                      ) : null
                    })}
                  </div>
                )}
                {formData.isPersonal && (
                  <p className="text-xs text-gray-500 mt-1">
                    Personal ToDos are automatically assigned to you.
                  </p>
                )}
                {!formData.isPersonal && formData.assignedUsers.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Hold Ctrl/Cmd to select multiple users
                  </p>
                )}
              </div>
            </div>

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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    {formatClientName(client)} {client.company ? `(${client.company})` : ""}
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="projectId">Project (Optional)</Label>
              <div className="space-y-2">
                {filteredProjects.length > 5 && (
                  <Input
                    type="text"
                    placeholder="Search projects..."
                    value={projectSearchTerm}
                    onChange={(e) => setProjectSearchTerm(e.target.value)}
                    className="mb-2"
                  />
                )}
                <Select
                  id="projectId"
                  value={formData.projectId}
                  onChange={(e) => {
                    const newProjectId = e.target.value
                    setFormData({ 
                      ...formData, 
                      projectId: newProjectId,
                      // Clear dependent fields when project changes
                      proposalId: "",
                      proposalItemId: "",
                      invoiceId: "",
                    })
                  }}
                  disabled={formData.clientId && filteredProjects.length === 0 || !!formData.leadId}
                >
                  <option value="">No project</option>
                  {filteredProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
                {projectSearchTerm && filteredProjects.length === 0 && (
                  <p className="text-sm text-gray-500">No projects found matching &quot;{projectSearchTerm}&quot;</p>
                )}
                {formData.clientId && !projectSearchTerm && filteredProjects.length === 0 && (
                  <p className="text-sm text-gray-500">No projects found for this client</p>
                )}
                {formData.leadId && (
                  <p className="text-sm text-gray-500">Projects can only be selected when a Client is selected</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="proposalId">Proposal (Optional)</Label>
              <Select
                id="proposalId"
                value={formData.proposalId}
                onChange={(e) => setFormData({ ...formData, proposalId: e.target.value, proposalItemId: "" })}
                disabled={!!formData.projectId && filteredProposals.length === 0}
              >
                <option value="">No proposal</option>
                {filteredProposals.map((proposal) => (
                  <option key={proposal.id} value={proposal.id}>
                    {proposal.title} {proposal.proposalNumber && `(#${proposal.proposalNumber})`}
                  </option>
                ))}
              </Select>
              {formData.projectId && filteredProposals.length === 0 && (
                <p className="text-sm text-gray-500">No proposal linked to this project</p>
              )}
            </div>
          </div>

          {formData.proposalId && filteredProposalItems.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="proposalItemId">Proposal Line Item (Optional)</Label>
              <Select
                id="proposalItemId"
                value={formData.proposalItemId}
                onChange={(e) => setFormData({ ...formData, proposalItemId: e.target.value })}
              >
                <option value="">No specific line item</option>
                {filteredProposalItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.description}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoiceId">Invoice (Optional)</Label>
              <Select
                id="invoiceId"
                value={formData.invoiceId}
                onChange={(e) => setFormData({ ...formData, invoiceId: e.target.value })}
                disabled={!!formData.projectId && filteredInvoices.length === 0}
              >
                <option value="">No invoice</option>
                {filteredInvoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoiceNumber || invoice.id.slice(0, 8)}
                  </option>
                ))}
              </Select>
              {formData.projectId && filteredInvoices.length === 0 && (
                <p className="text-sm text-gray-500">No invoices found for this project</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date (Optional)</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedEndDate">Estimated End Date (Optional)</Label>
              <Input
                id="estimatedEndDate"
                type="date"
                value={formData.estimatedEndDate}
                onChange={(e) => setFormData({ ...formData, estimatedEndDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date (Optional)</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
          </div>

          {isReassigning && (
            <div className="space-y-2">
              <Label htmlFor="reassignmentReason">Reassignment Reason (Optional)</Label>
              <Textarea
                id="reassignmentReason"
                value={reassignmentReason}
                onChange={(e) => setReassignmentReason(e.target.value)}
                rows={2}
                placeholder="Explain why this ToDo is being reassigned..."
              />
            </div>
          )}

          {initialData?.id && 
           formData.dueDate !== (initialData.dueDate ? new Date(initialData.dueDate).toISOString().split("T")[0] : "") &&
           (() => {
             const assignedUserIds = initialData?.assignments 
               ? initialData.assignments.map((a: any) => a.user?.id || a.userId).filter(Boolean)
               : (initialData?.assignedTo ? [initialData.assignedTo] : [])
             return assignedUserIds.includes(session?.user?.id || "") || session?.user?.id === initialData.assignedTo
           })() && (
            <div className="space-y-2">
              <Label htmlFor="dueDateChangeReason">Due Date Change Reason (Optional)</Label>
              <Textarea
                id="dueDateChangeReason"
                value={dueDateChangeReason}
                onChange={(e) => setDueDateChangeReason(e.target.value)}
                rows={2}
                placeholder="Explain why the due date is being changed..."
              />
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex space-x-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : initialData?.id ? "Update ToDo" : "Create ToDo"}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

