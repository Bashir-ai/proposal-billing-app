"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { Loader2, Bell } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface SendPaymentReminderButtonProps {
  invoiceId: string
  reminderNumber?: number
}

export function SendPaymentReminderButton({ invoiceId, reminderNumber = 1 }: SendPaymentReminderButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSendReminder = async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch(`/api/bills/${invoiceId}/send-reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderNumber }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to send payment reminder")
      }

      setSuccess(true)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "An error occurred while sending the reminder.")
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
          <AlertDescription>Payment reminder sent successfully!</AlertDescription>
        </Alert>
      )}
      <Button
        onClick={handleSendReminder}
        disabled={loading}
        variant="outline"
        className="bg-yellow-50 hover:bg-yellow-100 border-yellow-200"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Bell className="mr-2 h-4 w-4" />
            Send Payment Reminder
          </>
        )}
      </Button>
    </div>
  )
}


