"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatDate, formatCurrency } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Calendar, Clock, DollarSign } from "lucide-react"
import { cn } from "@/lib/utils"

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

interface TimesheetTimelineProps {
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

type ViewMode = "week" | "month"

export function TimesheetTimeline({ initialFilters, currentUserId, userRole }: TimesheetTimelineProps) {
  const [timesheetEntries, setTimesheetEntries] = useState<TimesheetEntry[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [filters, setFilters] = useState(initialFilters || {})

  useEffect(() => {
    if (initialFilters) {
      setFilters(initialFilters)
    }
  }, [initialFilters])

  // Calculate date range based on view mode
  const { startDate, endDate, dateHeaders } = useMemo(() => {
    const start = new Date(currentDate)
    const end = new Date(currentDate)
    const headers: string[] = []

    if (viewMode === "week") {
      // Start of week (Monday)
      const day = start.getDay()
      const diff = start.getDate() - day + (day === 0 ? -6 : 1)
      start.setDate(diff)
      start.setHours(0, 0, 0, 0)

      // End of week (Sunday)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)

      // Generate headers for each day
      for (let i = 0; i < 7; i++) {
        const date = new Date(start)
        date.setDate(start.getDate() + i)
        headers.push(date.toISOString().split("T")[0])
      }
    } else {
      // Start of month
      start.setDate(1)
      start.setHours(0, 0, 0, 0)

      // End of month
      end.setMonth(start.getMonth() + 1)
      end.setDate(0)
      end.setHours(23, 59, 59, 999)

      // Generate headers for each day in month
      const daysInMonth = end.getDate()
      for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(start)
        date.setDate(i)
        headers.push(date.toISOString().split("T")[0])
      }
    }

    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
      dateHeaders: headers,
    }
  }, [currentDate, viewMode])

  useEffect(() => {
    if (filters) {
      fetchData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, startDate, endDate])

  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.userId) params.append("userId", filters.userId)
      if (filters.clientId) params.append("clientId", filters.clientId)
      if (filters.projectId) params.append("projectId", filters.projectId)
      if (filters.billed) params.append("billed", filters.billed)
      if (filters.type) params.append("type", filters.type)
      params.append("startDate", startDate)
      params.append("endDate", endDate)

      const response = await fetch(`/api/timesheets/timeline?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setTimesheetEntries(data.timesheetEntries || [])
        setCharges(data.charges || [])
      }
    } catch (error) {
      console.error("Failed to fetch timeline data:", error)
    } finally {
      setLoading(false)
    }
  }

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate)
    if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7))
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1))
    }
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // Combine and group items by date
  const itemsByDate = useMemo(() => {
    const grouped: Record<string, TimelineItem[]> = {}
    
    timesheetEntries.forEach(entry => {
      const dateKey = entry.date.split("T")[0]
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(entry)
    })

    charges.forEach(charge => {
      const dateKey = charge.date.split("T")[0]
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(charge)
    })

    return grouped
  }, [timesheetEntries, charges])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Loading timeline...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Timesheet & Charges Timeline</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === "week" ? "month" : "week")}
            >
              {viewMode === "week" ? "Month View" : "Week View"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
            >
              <Calendar className="h-4 w-4 mr-1" />
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate("prev")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate("next")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          {viewMode === "week" 
            ? `${formatDate(new Date(startDate))} - ${formatDate(new Date(endDate))}`
            : new Date(currentDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })
          }
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-full">
            {/* Date Headers */}
            <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: `repeat(${dateHeaders.length}, minmax(120px, 1fr))` }}>
              {dateHeaders.map(dateStr => {
                const date = new Date(dateStr)
                const isToday = dateStr === new Date().toISOString().split("T")[0]
                return (
                  <div
                    key={dateStr}
                    className={cn(
                      "text-center p-2 border rounded",
                      isToday && "bg-blue-50 border-blue-300 font-semibold"
                    )}
                  >
                    <div className="text-xs text-gray-500">
                      {date.toLocaleDateString("en-US", { weekday: "short" })}
                    </div>
                    <div className="text-sm font-medium">
                      {date.getDate()}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Timeline Grid - One row per date */}
            <div className="space-y-2">
              {dateHeaders.map((dateStr, rowIdx) => {
                const dayItems = itemsByDate[dateStr] || []
                const date = new Date(dateStr)
                const isToday = dateStr === new Date().toISOString().split("T")[0]
                const isPast = date < new Date() && !isToday

                return (
                  <div
                    key={dateStr}
                    className={cn(
                      "grid gap-2 p-2 border rounded min-h-[100px]",
                      isToday && "bg-blue-50 border-blue-300",
                      isPast && "bg-gray-50"
                    )}
                    style={{ gridTemplateColumns: `repeat(${dateHeaders.length}, minmax(120px, 1fr))` }}
                  >
                    {dateHeaders.map((headerDate, colIdx) => {
                      if (headerDate === dateStr) {
                        return (
                          <div key={colIdx} className="space-y-1">
                            {dayItems.map(item => {
                              if (item.type === "timesheet") {
                                const entry = item as TimesheetEntry
                                return (
                                  <div
                                    key={entry.id}
                                    className={cn(
                                      "p-2 rounded border text-xs cursor-pointer hover:shadow-md transition-shadow",
                                      entry.billed 
                                        ? "bg-green-50 border-green-300 text-green-800" 
                                        : entry.billable
                                        ? "bg-blue-50 border-blue-300 text-blue-800"
                                        : "bg-gray-50 border-gray-300 text-gray-800"
                                    )}
                                    title={`${entry.description || "No description"}\nHours: ${entry.hours}\nRate: ${entry.rate ? formatCurrency(entry.rate, "EUR") : "N/A"}\nUser: ${entry.user.name}\nProject: ${entry.project.name}\nClient: ${entry.project.client.name}\nBilled: ${entry.billed ? "Yes" : "No"}`}
                                  >
                                    <div className="flex items-center gap-1 mb-1">
                                      <Clock className="h-3 w-3" />
                                      <span className="font-medium">{entry.hours}h</span>
                                    </div>
                                    <div className="truncate">{entry.description || "No description"}</div>
                                    <div className="text-xs opacity-75 truncate">{entry.user.name}</div>
                                    <div className="text-xs opacity-75 truncate">{entry.project.name}</div>
                                  </div>
                                )
                              } else {
                                const charge = item as Charge
                                return (
                                  <div
                                    key={charge.id}
                                    className={cn(
                                      "p-2 rounded border text-xs cursor-pointer hover:shadow-md transition-shadow",
                                      charge.billed
                                        ? "bg-purple-50 border-purple-300 text-purple-800"
                                        : "bg-orange-50 border-orange-300 text-orange-800"
                                    )}
                                    title={`${charge.description}\nAmount: ${formatCurrency(charge.amount, "EUR")}\nQuantity: ${charge.quantity || 1}\nUnit Price: ${charge.unitPrice ? formatCurrency(charge.unitPrice, "EUR") : "N/A"}\nProject: ${charge.project.name}\nClient: ${charge.project.client.name}\nBilled: ${charge.billed ? "Yes" : "No"}`}
                                  >
                                    <div className="flex items-center gap-1 mb-1">
                                      <DollarSign className="h-3 w-3" />
                                      <span className="font-medium">{formatCurrency(charge.amount, "EUR")}</span>
                                    </div>
                                    <div className="truncate">{charge.description}</div>
                                    <div className="text-xs opacity-75 truncate">{charge.project.name}</div>
                                  </div>
                                )
                              }
                            })}
                            {dayItems.length === 0 && (
                              <div className="text-xs text-gray-400 text-center py-2">No entries</div>
                            )}
                          </div>
                        )
                      }
                      return <div key={colIdx}></div>
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
