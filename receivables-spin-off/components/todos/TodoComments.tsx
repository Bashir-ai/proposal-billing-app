"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { formatDate } from "@/lib/utils"
import { Pencil, Trash2, Send } from "lucide-react"

interface TodoComment {
  id: string
  comment: string
  createdAt: string
  updatedAt: string
  creator: {
    id: string
    name: string
    email: string
  }
}

interface TodoCommentsProps {
  todoId: string
}

export function TodoComments({ todoId }: TodoCommentsProps) {
  const { data: session } = useSession()
  const [comments, setComments] = useState<TodoComment[]>([])
  const [newComment, setNewComment] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState("")

  useEffect(() => {
    fetchComments()
  }, [todoId])

  const fetchComments = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/todos/${todoId}/comments`)
      if (response.ok) {
        const data = await response.json()
        setComments(data)
      }
    } catch (error) {
      console.error("Error fetching comments:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/todos/${todoId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: newComment }),
      })

      if (response.ok) {
        setNewComment("")
        fetchComments()
      } else {
        const data = await response.json()
        alert(data.error || "Failed to add comment")
      }
    } catch (error) {
      console.error("Error adding comment:", error)
      alert("Failed to add comment")
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (comment: TodoComment) => {
    setEditingId(comment.id)
    setEditingText(comment.comment)
  }

  const handleUpdate = async (commentId: string) => {
    if (!editingText.trim()) return

    try {
      const response = await fetch(`/api/todos/${todoId}/comments/${commentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: editingText }),
      })

      if (response.ok) {
        setEditingId(null)
        setEditingText("")
        fetchComments()
      } else {
        const data = await response.json()
        alert(data.error || "Failed to update comment")
      }
    } catch (error) {
      console.error("Error updating comment:", error)
      alert("Failed to update comment")
    }
  }

  const handleDelete = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return

    try {
      const response = await fetch(`/api/todos/${todoId}/comments/${commentId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        fetchComments()
      } else {
        const data = await response.json()
        alert(data.error || "Failed to delete comment")
      }
    } catch (error) {
      console.error("Error deleting comment:", error)
      alert("Failed to delete comment")
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading comments...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comments & Updates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Comment Form */}
        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment or update..."
            rows={3}
            disabled={submitting}
          />
          <Button type="submit" size="sm" disabled={submitting || !newComment.trim()}>
            <Send className="h-4 w-4 mr-2" />
            {submitting ? "Adding..." : "Add Comment"}
          </Button>
        </form>

        {/* Comments List */}
        <div className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-sm text-gray-500">No comments yet. Be the first to add one!</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-sm">{comment.creator.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(comment.createdAt)}
                      {comment.updatedAt !== comment.createdAt && " (edited)"}
                    </p>
                  </div>
                  {session?.user?.id === comment.creator.id && (
                    <div className="flex gap-2">
                      {editingId === comment.id ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdate(comment.id)}
                            className="h-8 px-2"
                          >
                            Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingId(null)
                              setEditingText("")
                            }}
                            className="h-8 px-2"
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(comment)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(comment.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {editingId === comment.id ? (
                  <Textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    rows={3}
                    className="mt-2"
                  />
                ) : (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.comment}</p>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
