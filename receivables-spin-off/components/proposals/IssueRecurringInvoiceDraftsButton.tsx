"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Receipt } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface IssueRecurringInvoiceDraftsButtonProps {
  proposalId: string
  disabled?: boolean
}

export function IssueRecurringInvoiceDraftsButton({
  proposalId,
  disabled = false,
}: IssueRecurringInvoiceDraftsButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleIssue = async () => {
    setLoading(true)
    try {
      if (!confirm("Issue recurring invoice draft(s) that are due now?")) return

      const res = await fetch(`/api/proposals/${proposalId}/issue-recurring-invoice-drafts`, {
        method: "POST",
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to issue recurring invoice draft(s)")
      }

      const data = await res.json()
      const invoices = data?.invoices || []

      if (invoices.length === 1 && invoices[0]?.id) {
        router.push(`/dashboard/bills/${invoices[0].id}`)
      } else {
        router.refresh()
        toast.success(`Created ${invoices.length} invoice draft(s).`)
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to issue invoice draft(s)")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleIssue}
      disabled={disabled || loading}
      variant="default"
      className="bg-blue-600 hover:bg-blue-700"
    >
      <Receipt className="h-4 w-4 mr-2" />
      {loading ? "Issuing..." : "Issue Recurring Invoice Draft"}
    </Button>
  )
}

