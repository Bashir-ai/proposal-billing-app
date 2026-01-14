"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate, formatCurrency } from "@/lib/utils"
import { Clock, DollarSign } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface TimesheetEntry {
  id: string
  type: "timesheet"
  date: string
  hours: number
  rate: number | null
  description: string | null
  billable: boolean
  billed: boolean
  user: {
    id: string
    name: string
    email: string
  }
  project: {
    id: string
    name: string
    client: {
      id: string
      name: string
      company: string | null
    }
  }
}

interface Charge {
  id: string
  type: "charge"
  date: string
  amount: number
  quantity: number | null
  unitPrice: number | null
  description: string
  billed: boolean
  chargeType: string
  project: {
    id: string
    name: string
    client: {
      id: string
      name: string
      company: string | null
    }
  }
}

type TimelineItem = TimesheetEntry | Charge

interface TimesheetListProps {
  initialFilters?: {
    userId?: string
    clientId?: string
    projectId?: string
    startDate?: string
    endDate?: string
    billed?: string
    type?: string
  }
  currentUserId: string
  userRole: string
}

export function TimesheetList({ initialFilters, currentUserId, userRole }: TimesheetListProps) {
  const [timesheetEntries, setTimesheetEntries] = useState<TimesheetEntry[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(initialFilters || {})

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.userId) params.append("userId", filters.userId)
      if (filters.clientId) params.append("clientId", filters.clientId)
      if (filters.projectId) params.append("projectId", filters.projectId)
      if (filters.billed) params.append("billed", filters.billed)
      if (filters.type) params.append("type", filters.type)
      // Use a wide date range if not specified
      if (!filters.startDate) {
        const sixMonthsAgo = new Date()
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
        params.append("startDate", sixMonthsAgo.toISOString().split("T")[0])
      } else {
        params.append("startDate", filters.startDate)
      }
      if (!filters.endDate) {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        params.append("endDate", tomorrow.toISOString().split("T")[0])
      } else {
        params.append("endDate", filters.endDate)
      }

      const response = await fetch(`/api/timesheets/timeline?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setTimesheetEntries(data.timesheetEntries || [])
        setCharges(data.charges || [])
      }
    } catch (error) {
      console.error("Failed to fetch timesheet data:", error)
    } finally {
      setLoading(false)
    }
  }

  // Combine and sort all items by date (newest first)
  const allItems = useMemo(() => {
    const items: TimelineItem[] = [...timesheetEntries, ...charges]
    return items.sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return dateB - dateA // Newest first
    })
  }, [timesheetEntries, charges])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Loading timesheet entries...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timesheet Entries & Charges</CardTitle>
      </CardHeader>
      <CardContent>
        {allItems.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No timesheet entries or charges found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">User</th>
                  <th className="text-left p-2">Project</th>
                  <th className="text-left p-2">Client</th>
                  <th className="text-left p-2">Description</th>
                  <th className="text-right p-2">Hours</th>
                  <th className="text-right p-2">Rate/Price</th>
                  <th className="text-right p-2">Amount</th>
                  <th className="text-center p-2">Billable</th>
                  <th className="text-center p-2">Billed</th>
                </tr>
              </thead>
              <tbody>
                {allItems.map((item) => {
                  if (item.type === "timesheet") {
                    const entry = item as TimesheetEntry
                    const amount = (entry.rate || 0) * entry.hours
                    return (
                      <tr
                        key={entry.id}
                        className={cn(
                          "border-b hover:bg-gray-50",
                          entry.billed && "bg-green-50",
                          !entry.billed && entry.billable && "bg-blue-50"
                        )}
                      >
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-blue-600" />
                            <span className="text-xs">Timesheet</span>
                          </div>
                        </td>
                        <td className="p-2">{formatDate(entry.date)}</td>
                        <td className="p-2">
                          <Link
                            href={`/dashboard/projects/${entry.project.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {entry.user.name}
                          </Link>
                        </td>
                        <td className="p-2">
                          <Link
                            href={`/dashboard/projects/${entry.project.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {entry.project.name}
                          </Link>
                        </td>
                        <td className="p-2">{entry.project.client.name}</td>
                        <td className="p-2 max-w-xs truncate" title={entry.description || ""}>
                          {entry.description || "—"}
                        </td>
                        <td className="p-2 text-right">{entry.hours.toFixed(2)}</td>
                        <td className="p-2 text-right">
                          {entry.rate ? formatCurrency(entry.rate) : "—"}
                        </td>
                        <td className="p-2 text-right font-semibold">
                          {formatCurrency(amount)}
                        </td>
                        <td className="p-2 text-center">
                          {entry.billable ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {entry.billed ? (
                            <span className="text-green-600 font-semibold">✓</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  } else {
                    const charge = item as Charge
                    return (
                      <tr
                        key={charge.id}
                        className={cn(
                          "border-b hover:bg-gray-50",
                          charge.billed && "bg-purple-50",
                          !charge.billed && "bg-orange-50"
                        )}
                      >
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-purple-600" />
                            <span className="text-xs">Charge</span>
                          </div>
                        </td>
                        <td className="p-2">{formatDate(charge.date)}</td>
                        <td className="p-2">—</td>
                        <td className="p-2">
                          <Link
                            href={`/dashboard/projects/${charge.project.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {charge.project.name}
                          </Link>
                        </td>
                        <td className="p-2">{charge.project.client.name}</td>
                        <td className="p-2 max-w-xs truncate" title={charge.description}>
                          {charge.description}
                        </td>
                        <td className="p-2 text-right">—</td>
                        <td className="p-2 text-right">
                          {charge.unitPrice ? formatCurrency(charge.unitPrice) : "—"}
                        </td>
                        <td className="p-2 text-right font-semibold">
                          {formatCurrency(charge.amount)}
                        </td>
                        <td className="p-2 text-center">
                          <span className="text-green-600">✓</span>
                        </td>
                        <td className="p-2 text-center">
                          {charge.billed ? (
                            <span className="text-green-600 font-semibold">✓</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  }
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
