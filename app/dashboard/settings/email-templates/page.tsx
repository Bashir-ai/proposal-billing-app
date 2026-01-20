"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Edit, Trash2, Check, X } from "lucide-react"
import { useRouter } from "next/navigation"

interface EmailTemplate {
  id: string
  type: "PROPOSAL" | "INVOICE" | "OTHER"
  name: string
  subject: string
  body: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
  creator: {
    name: string
    email: string
  }
}

export default function EmailTemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [formData, setFormData] = useState({
    type: "PROPOSAL" as "PROPOSAL" | "INVOICE" | "OTHER",
    name: "",
    subject: "",
    body: "",
    isDefault: false,
  })

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/email-templates", {
        cache: "no-store", // Ensure fresh data
      })
      if (response.ok) {
        const data = await response.json()
        setTemplates(Array.isArray(data) ? data : [])
      } else {
        const errorData = await response.json().catch(() => ({ error: "Failed to load templates" }))
        console.error("Failed to fetch templates:", errorData)
        // Set empty array on error to prevent crashes
        setTemplates([])
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error)
      // Set empty array on error to prevent crashes
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      const response = await fetch("/api/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await fetchTemplates()
        setShowCreate(false)
        setFormData({
          type: "PROPOSAL",
          name: "",
          subject: "",
          body: "",
          isDefault: false,
        })
      } else {
        const data = await response.json()
        alert(data.error || "Failed to create template")
      }
    } catch (error) {
      console.error("Failed to create template:", error)
      alert("Failed to create template")
    }
  }

  const handleUpdate = async (id: string) => {
    try {
      const response = await fetch(`/api/email-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await fetchTemplates()
        setEditingId(null)
        setFormData({
          type: "PROPOSAL",
          name: "",
          subject: "",
          body: "",
          isDefault: false,
        })
      } else {
        const data = await response.json()
        alert(data.error || "Failed to update template")
      }
    } catch (error) {
      console.error("Failed to update template:", error)
      alert("Failed to update template")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return

    try {
      const response = await fetch(`/api/email-templates/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        await fetchTemplates()
      } else {
        const data = await response.json()
        alert(data.error || "Failed to delete template")
      }
    } catch (error) {
      console.error("Failed to delete template:", error)
      alert("Failed to delete template")
    }
  }

  const startEdit = (template: EmailTemplate) => {
    setEditingId(template.id)
    setFormData({
      type: template.type,
      name: template.name,
      subject: template.subject,
      body: template.body,
      isDefault: template.isDefault,
    })
    setShowCreate(false)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setShowCreate(false)
    setFormData({
      type: "PROPOSAL",
      name: "",
      subject: "",
      body: "",
      isDefault: false,
    })
  }

  const groupedTemplates = {
    PROPOSAL: templates.filter(t => t.type === "PROPOSAL"),
    INVOICE: templates.filter(t => t.type === "INVOICE"),
    OTHER: templates.filter(t => t.type === "OTHER"),
  }

  if (loading) {
    return <div className="p-8">Loading templates...</div>
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Email Templates</h1>
        <p className="text-gray-600">Manage email templates for proposals and invoices</p>
      </div>

      <div className="mb-6">
        <Button onClick={() => {
          setShowCreate(true)
          setEditingId(null)
          setFormData({
            type: "PROPOSAL",
            name: "",
            subject: "",
            body: "",
            isDefault: false,
          })
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Create/Edit Form */}
      {(showCreate || editingId) && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{editingId ? "Edit Template" : "Create Template"}</CardTitle>
            <CardDescription>
              Use variables like {"{{proposal.title}}"}, {"{{client.name}}"}, {"{{reviewLink}}"}, etc.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="template-type">Type</Label>
                <select
                  id="template-type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full h-10 px-3 border rounded-md"
                  disabled={!!editingId}
                >
                  <option value="PROPOSAL">Proposal</option>
                  <option value="INVOICE">Invoice</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-name">Name</Label>
                <Input
                  id="template-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Template name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-subject">Subject</Label>
              <Input
                id="template-subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Email subject (use {{variables}})"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-body">Body (HTML)</Label>
              <Textarea
                id="template-body"
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                placeholder="Email body HTML (use {{variables}})"
                className="min-h-[300px] font-mono text-sm"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="template-default"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="template-default">Set as default template for this type</Label>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={cancelEdit}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={() => editingId ? handleUpdate(editingId) : handleCreate()}>
                <Check className="h-4 w-4 mr-2" />
                {editingId ? "Update" : "Create"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates List */}
      {(["PROPOSAL", "INVOICE", "OTHER"] as const).map((type) => (
        <div key={type} className="mb-8">
          <h2 className="text-xl font-bold mb-4">{type} Templates</h2>
          {groupedTemplates[type].length === 0 ? (
            <p className="text-gray-500 text-sm">No templates for {type.toLowerCase()} yet.</p>
          ) : (
            <div className="space-y-4">
              {groupedTemplates[type].map((template) => (
                <Card key={template.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {template.name}
                          {template.isDefault && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Default</span>
                          )}
                        </CardTitle>
                        <CardDescription>
                          Created by {template.creator.name} on {new Date(template.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(template)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(template.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Subject:</p>
                        <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{template.subject}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Body Preview:</p>
                        <div
                          className="text-sm text-gray-900 bg-gray-50 p-4 rounded max-h-[200px] overflow-y-auto prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: template.body.substring(0, 500) + (template.body.length > 500 ? "..." : "") }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
