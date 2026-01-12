"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Calendar } from "lucide-react"

interface TimeFilterProps {
  startDate: string | null
  endDate: string | null
  onDateChange: (startDate: string | null, endDate: string | null) => void
}

export function TimeFilter({ startDate, endDate, onDateChange }: TimeFilterProps) {
  const [customStartDate, setCustomStartDate] = useState<string>(startDate || "")
  const [customEndDate, setCustomEndDate] = useState<string>(endDate || "")

  useEffect(() => {
    if (startDate) setCustomStartDate(startDate)
    if (endDate) setCustomEndDate(endDate)
  }, [startDate, endDate])

  const setQuickFilter = (filter: string) => {
    const now = new Date()
    let newStartDate: string | null = null
    let newEndDate: string | null = null

    switch (filter) {
      case "thisMonth":
        newStartDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
        newEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]
        break
      case "lastMonth":
        newStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0]
        newEndDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0]
        break
      case "thisYear":
        newStartDate = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0]
        newEndDate = new Date(now.getFullYear(), 11, 31).toISOString().split("T")[0]
        break
      case "lastYear":
        newStartDate = new Date(now.getFullYear() - 1, 0, 1).toISOString().split("T")[0]
        newEndDate = new Date(now.getFullYear() - 1, 11, 31).toISOString().split("T")[0]
        break
      case "custom":
        // Keep current custom dates
        return
      case "clear":
        newStartDate = null
        newEndDate = null
        break
    }

    setCustomStartDate(newStartDate || "")
    setCustomEndDate(newEndDate || "")
    onDateChange(newStartDate, newEndDate)
  }

  const handleCustomDateApply = () => {
    onDateChange(
      customStartDate || null,
      customEndDate || null
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <Label className="text-sm font-semibold">Time Period</Label>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuickFilter("thisMonth")}
              className={startDate && endDate && new Date(startDate).getMonth() === new Date().getMonth() ? "bg-blue-50 border-blue-300" : ""}
            >
              This Month
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuickFilter("lastMonth")}
            >
              Last Month
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuickFilter("thisYear")}
              className={startDate && endDate && new Date(startDate).getFullYear() === new Date().getFullYear() ? "bg-blue-50 border-blue-300" : ""}
            >
              This Year
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuickFilter("lastYear")}
            >
              Last Year
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuickFilter("clear")}
            >
              Clear
            </Button>
          </div>

          {/* Custom Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="text-xs">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate" className="text-xs">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleCustomDateApply}
                className="w-full"
              >
                Apply Custom Range
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
