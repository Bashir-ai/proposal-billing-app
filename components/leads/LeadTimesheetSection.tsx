"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatDate, formatCurrency } from "@/lib/utils"
import { Clock, Plus, Trash2, Pencil, Archive } from "lucide-react"
import { cn } from "@/lib/utils"
import { LeadTimesheetEntryForm } from "./LeadTimesheetEntryForm"

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

interface LeadTimesheetSectionProps {
  leadId: string
  users: Array<{ id: string; name: string; email: string; defaultHourlyRate?: number | null }>
}

export function LeadTimesheetSection({ leadId, users }: LeadTimesheetSectionProps) {
  const [entries, setEntries] = useState<TimesheetEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null)
  const [includeArchived, setIncludeArchived] = useState(false)

  useEffect(() => {
    fetchEntries()
  }, [leadId, includeArchived])

  const fetchEntries = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (includeArchived) {
        params.set("archived", "true")
      }
      const response = await fetch(`/api/leads/${leadId}/timesheet?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setEntries(data)
      }
    } catch (error) {
      console.error("Failed to fetch timesheet entries:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (entryId: string) => {
    if (!confirm("Are you sure you want to delete this timesheet entry?")) {
      return
    }

    try {
      const response = await fetch(`/api/leads/${leadId}/timesheet/${entryId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete timesheet entry")
      }

      fetchEntries()
    } catch (error) {
      console.error("Error deleting timesheet entry:", error)
      alert(error instanceof Error ? error.message : "Failed to delete timesheet entry")
    }
  }

  const handleEdit = (entry: TimesheetEntry) => {
    setEditingEntry(entry)
    setShowAddForm(true)
  }

  const handleFormSuccess = () => {
    setShowAddForm(false)
    setEditingEntry(null)
    fetchEntries()
  }

  // Calculate totals
  const totals = useMemo(() => {
    const activeEntries = entries.filter(e => !e.archivedAt)
    const totalHours = activeEntries.reduce((sum, e) => sum + e.hours, 0)
    const totalBillable = activeEntries
      .filter(e => e.billable && !e.billed)
      .reduce((sum, e) => sum + (e.rate || 0) * e.hours, 0)
    const totalBilled = activeEntries
      .filter(e => e.billed)
      .reduce((sum, e) => sum + (e.rate || 0) * e.hours, 0)
    return { totalHours, totalBillable, totalBilled }
  }, [entries])

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
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Timesheet Entries</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIncludeArchived(!includeArchived)}
              >
                <Archive className="h-4 w-4 mr-2" />
                {includeArchived ? "Hide Archived" : "Show Archived"}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditingEntry(null)
                  setShowAddForm(true)
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Entry
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-gray-600">Total Hours</div>
              <div className="text-2xl font-semibold">{totals.totalHours.toFixed(2)}</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-gray-600">Billable Amount</div>
              <div className="text-2xl font-semibold">{formatCurrency(totals.totalBillable)}</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-sm text-gray-600">Billed Amount</div>
              <div className="text-2xl font-semibold">{formatCurrency(totals.totalBilled)}</div>
            </div>
          </div>

          {/* Entries Table */}
          {entries.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No timesheet entries found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">User</th>
                    <th className="text-left p-2">Description</th>
                    <th className="text-right p-2">Hours</th>
                    <th className="text-right p-2">Rate</th>
                    <th className="text-right p-2">Amount</th>
                    <th className="text-center p-2">Billable</th>
                    <th className="text-center p-2">Billed</th>
                    <th className="text-center p-2 w-20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const amount = (entry.rate || 0) * entry.hours
                    return (
                      <tr
                        key={entry.id}
                        className={cn(
                          "border-b hover:bg-gray-50",
                          entry.archivedAt && "opacity-50 bg-gray-100",
                          entry.billed && "bg-green-50",
                          !entry.billed && entry.billable && "bg-blue-50"
                        )}
                      >
                        <td className="p-2">{formatDate(entry.date)}</td>
                        <td className="p-2">{entry.user.name}</td>
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
                        <td className="p-2 text-center">
                          <div className="flex justify-center gap-2">
                            {!entry.archivedAt && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(entry)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(entry.id)}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                            {entry.archivedAt && (
                              <span className="text-xs text-gray-500">Archived</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showAddForm && (
        <LeadTimesheetEntryForm
          leadId={leadId}
          entry={editingEntry}
          users={users}
          isOpen={showAddForm}
          onClose={() => {
            setShowAddForm(false)
            setEditingEntry(null)
          }}
          onSuccess={handleFormSuccess}
        />
      )}
    </>
  )
}
