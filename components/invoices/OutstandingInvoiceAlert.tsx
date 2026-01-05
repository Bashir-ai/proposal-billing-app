"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import { formatDate } from "@/lib/utils"

interface OutstandingInvoiceAlertProps {
  invoice: {
    dueDate: Date | string | null
    becameOutstandingAt: Date | string | null
    lastReminderSentAt: Date | string | null
    reminderCount: number
  }
}

export function OutstandingInvoiceAlert({ invoice }: OutstandingInvoiceAlertProps) {
  if (!invoice.dueDate) {
    return null
  }

  const dueDate = new Date(invoice.dueDate)
  const now = new Date()
  const isOutstanding = dueDate < now && invoice.becameOutstandingAt

  if (!isOutstanding) {
    return null
  }

  const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
  const nextReminderDate = invoice.lastReminderSentAt
    ? new Date(new Date(invoice.lastReminderSentAt).getTime() + 7 * 24 * 60 * 60 * 1000)
    : null

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Outstanding Invoice</AlertTitle>
      <AlertDescription>
        <div className="space-y-1">
          <p>This invoice is {daysOverdue} day{daysOverdue !== 1 ? "s" : ""} overdue.</p>
          {invoice.reminderCount > 0 && (
            <p>{invoice.reminderCount} reminder{invoice.reminderCount !== 1 ? "s" : ""} sent.</p>
          )}
          {nextReminderDate && nextReminderDate > now && (
            <p>Next reminder: {formatDate(nextReminderDate)}</p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}



