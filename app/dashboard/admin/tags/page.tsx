"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, Edit2 } from "lucide-react"

interface ProposalTag {
  id: string
  name: string
  description?: string | null
  color?: string | null
  _count?: {
    proposals: number
  }
}

export default function TagsManagementPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [tags, setTags] = useState<ProposalTag[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#3B82F6",
  })
  const [error, setError] = useState("")

  useEffect(() => {
    if (session?.user.role !== "ADMIN") {
      router.push("/dashboard")
      return
    }
    fetchTags()
  }, [session, router])

  const fetchTags = async () => {
    try {
      const response = await fetch("/api/proposal-tags")
      if (response.ok) {
        const data = await response.json()
        setTags(data)
      }
    } catch (error) {
      console.error("Failed to fetch tags:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSaving(true)

    try {
      const url = editingId ? `/api/proposal-tags/${editingId}` : "/api/proposal-tags"
      const method = editingId ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Failed to save tag")
      } else {
        setFormData({ name: "", description: "", color: "#3B82F6" })
        setEditingId(null)
        fetchTags()
      }
    } catch (error) {
      setError("An error occurred. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (tag: ProposalTag) => {
    setEditingId(tag.id)
    setFormData({
      name: tag.name,
      description: tag.description || "",
      color: tag.color || "#3B82F6",
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tag?")) return

    try {
      const response = await fetch(`/api/proposal-tags/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        fetchTags()
      } else {
        const data = await response.json()
        alert(data.error || "Failed to delete tag")
      }
    } catch (error) {
      alert("An error occurred. Please try again.")
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setFormData({ name: "", description: "", color: "#3B82F6" })
    setError("")
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (session?.user.role !== "ADMIN") {
    return null
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Manage Proposal Tags</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{editingId ? "Edit Tag" : "Create New Tag"}</CardTitle>
          <CardDescription>
            Tags help categorize proposals by area of service or law
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tag Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., Corporate Law, Tax, Litigation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Optional description of this tag"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#3B82F6"
                  className="flex-1"
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}

            <div className="flex space-x-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update Tag" : "Create Tag"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Tags</CardTitle>
          <CardDescription>
            {tags.length} tag{tags.length !== 1 ? "s" : ""} defined
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tags.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No tags created yet. Create your first tag above.
            </p>
          ) : (
            <div className="space-y-2">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: tag.color || "#3B82F6" }}
                    />
                    <div>
                      <p className="font-semibold">{tag.name}</p>
                      {tag.description && (
                        <p className="text-sm text-gray-600">{tag.description}</p>
                      )}
                      {tag._count && (
                        <p className="text-xs text-gray-500">
                          Used in {tag._count.proposals} proposal{tag._count.proposals !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(tag)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(tag.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


