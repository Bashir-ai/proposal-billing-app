"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { EmailEditDialog } from "./EmailEditDialog"

interface SendToClientButtonProps {
  proposalId: string
}

export function SendToClientButton({ proposalId }: SendToClientButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")
  const [preparingEmail, setPreparingEmail] = useState(false)
  const router = useRouter()

  const prepareEmailTemplate = useCallback(async () => {
    try {
      const response = await fetch(`/api/proposals/${proposalId}/prepare-email`)
      if (!response.ok) {
        throw new Error("Failed to prepare email template")
      }
      const data = await response.json()
      setEmailSubject(data.subject)
      setEmailBody(data.body)
      setPreparingEmail(false)
    } catch (err: any) {
      console.error("Failed to prepare email template:", err)
      // Use fallback
      setEmailSubject(`Proposal Approval Request`)
      setEmailBody(`<p>Please review and approve the proposal.</p>`)
      setPreparingEmail(false)
    }
  }, [proposalId])

  // Prepare email template when dialog opens
  useEffect(() => {
    if (showEditDialog) {
      setPreparingEmail(true)
      prepareEmailTemplate()
    }
  }, [showEditDialog, prepareEmailTemplate])

  const handleSend = async (subject: string, body: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/proposals/${proposalId}/send-client-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to send email")
      }

      setShowEditDialog(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div>
        <Button onClick={() => setShowEditDialog(true)} disabled={loading} variant="outline">
          {loading ? "Sending..." : "Send for Approval"}
        </Button>
        {error && (
          <p className="text-sm text-red-600 mt-2">{error}</p>
        )}
      </div>

      <EmailEditDialog
        open={showEditDialog}
        onClose={() => {
          setShowEditDialog(false)
          setError(null)
        }}
        onSend={handleSend}
        defaultSubject={emailSubject}
        defaultBody={emailBody}
        loading={loading || preparingEmail}
      />
    </>
  )
}
