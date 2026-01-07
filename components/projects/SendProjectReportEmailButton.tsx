"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { Loader2, Mail } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface SendProjectReportEmailButtonProps {
  projectId: string
}

export function SendProjectReportEmailButton({ projectId }: SendProjectReportEmailButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSendEmail = async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch(`/api/projects/${projectId}/reports/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to send project report email")
      }

      setSuccess(true)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "An error occurred while sending the email.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mb-4 bg-green-50 border-green-200">
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>Project report email sent successfully!</AlertDescription>
        </Alert>
      )}
      <Button
        onClick={handleSendEmail}
        disabled={loading}
        variant="outline"
        className="bg-blue-50 hover:bg-blue-100 border-blue-200"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Mail className="mr-2 h-4 w-4" />
            Email Project Report
          </>
        )}
      </Button>
    </div>
  )
}


