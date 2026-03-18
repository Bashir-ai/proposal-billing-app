"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { FileText } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface TimesheetEntry {
  id: string
  date: string
  hours: number
  rate: number | null
  description: string | null
  billable: boolean
  billed: boolean
  archivedAt: string | null
  user: {
    id: string
    name: string
    email: string
  }
}

interface GenerateInvoiceButtonProps {
  leadId: string
  leadName: string
}

export function GenerateInvoiceButton({ leadId, leadName }: GenerateInvoiceButtonProps) {
  const router = useRouter()
  const [entries, setEntries] = useState<TimesheetEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Check for unbilled timesheet entries
    fetch(`/api/leads/${leadId}/timesheet?archived=false`)
      .then((res) => res.json())
      .then((data) => {
        const unbilled = data.filter((e: TimesheetEntry) => e.billable && !e.billed && !e.archivedAt)
        setEntries(unbilled)
      })
      .catch(console.error)
      .finally(() => setChecking(false))
  }, [leadId])

  const handleGenerateInvoice = () => {
    if (entries.length === 0) {
      alert("No billable timesheet entries available to invoice")
      return
    }

    // Navigate to invoice creation page with lead pre-selected
    const timesheetEntryIds = entries.map(e => e.id).join(",")
    router.push(`/dashboard/bills/new?leadId=${leadId}&timesheetEntryIds=${timesheetEntryIds}`)
  }

  const totalBillable = entries.reduce((sum, e) => sum + (e.rate || 0) * e.hours, 0)

  if (checking) {
    return (
      <Button size="sm" disabled>
        <FileText className="h-4 w-4 mr-2" />
        Checking...
      </Button>
    )
  }

  if (entries.length === 0) {
    return (
      <Button size="sm" disabled variant="outline">
        <FileText className="h-4 w-4 mr-2" />
        No Billable Hours
      </Button>
    )
  }

  return (
    <Button
      size="sm"
      onClick={handleGenerateInvoice}
      disabled={loading}
    >
      <FileText className="h-4 w-4 mr-2" />
      Generate Invoice ({entries.length} entries, {formatCurrency(totalBillable)})
    </Button>
  )
}
