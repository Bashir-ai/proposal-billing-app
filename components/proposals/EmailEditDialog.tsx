"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { X, Send, Eye } from "lucide-react"

interface EmailEditDialogProps {
  open: boolean
  onClose: () => void
  onSend: (subject: string, body: string) => Promise<void>
  defaultSubject: string
  defaultBody: string
  loading?: boolean
}

export function EmailEditDialog({
  open,
  onClose,
  onSend,
  defaultSubject,
  defaultBody,
  loading = false,
}: EmailEditDialogProps) {
  const [subject, setSubject] = useState(defaultSubject)
  const [body, setBody] = useState(defaultBody)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    if (open) {
      setSubject(defaultSubject)
      setBody(defaultBody)
      setShowPreview(false)
    }
  }, [open, defaultSubject, defaultBody])

  if (!open) return null

  const handleSend = async () => {
    await onSend(subject, body)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0 border-b">
          <div className="flex items-center justify-between">
            <CardTitle>Edit Email Before Sending</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={loading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-4 p-6">
          <div className="space-y-2">
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-body">Body</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                disabled={loading}
              >
                <Eye className="h-4 w-4 mr-2" />
                {showPreview ? "Edit" : "Preview"}
              </Button>
            </div>
            {showPreview ? (
              <div
                className="min-h-[400px] border rounded-lg p-4 bg-white prose max-w-none"
                dangerouslySetInnerHTML={{ __html: body }}
              />
            ) : (
              <Textarea
                id="email-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Email body (HTML)"
                className="min-h-[400px] font-mono text-sm"
                disabled={loading}
              />
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={loading || !subject.trim() || !body.trim()}
            >
              <Send className="h-4 w-4 mr-2" />
              {loading ? "Sending..." : "Send Email"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
