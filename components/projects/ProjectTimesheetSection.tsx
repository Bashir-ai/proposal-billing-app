"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatDate, formatCurrency } from "@/lib/utils"
import { TimesheetEntryForm } from "./TimesheetEntryForm"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface User {
  id: string
  name: string
  email: string
}

interface TimesheetEntry {
  id: string
  userId: string
  date: string | Date
  hours: number
  rate: number | null
  description?: string | null
  billable: boolean
  billed: boolean
  user: User
}

interface ProposalData {
  id: string
  useBlendedRate: boolean
  blendedRate: number | null
  items: Array<{
    id: string
    personId?: string | null
    rate?: number | null
  }>
}

interface ProjectTimesheetSectionProps {
  projectId: string
  initialEntries: TimesheetEntry[]
  proposal?: ProposalData | null
}

export function ProjectTimesheetSection({ projectId, initialEntries, proposal }: ProjectTimesheetSectionProps) {
  const [entries, setEntries] = useState<TimesheetEntry[]>(initialEntries)
  const [users, setUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set())
  const router = useRouter()

  useEffect(() => {
    // Fetch users
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        // Filter out clients (users with role CLIENT)
        const staffUsers = data.filter((user: any) => user.role !== "CLIENT")
        setUsers(staffUsers)
      })
      .catch(console.error)
  }, [])

  const handleRefresh = () => {
    setLoading(true)
    fetch(`/api/projects/${projectId}/timesheet`)
      .then((res) => res.json())
      .then((data) => {
        setEntries(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Failed to refresh timesheet entries:", err)
        setLoading(false)
      })
  }

  const handleToggleSelect = (entryId: string) => {
    setSelectedEntries(prev => {
      const newSet = new Set(prev)
      if (newSet.has(entryId)) {
        newSet.delete(entryId)
      } else {
        newSet.add(entryId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedEntries.size === entries.length) {
      setSelectedEntries(new Set())
    } else {
      setSelectedEntries(new Set(entries.map(e => e.id)))
    }
  }

  const handleEditSelected = () => {
    if (selectedEntries.size === 1) {
      const entryId = Array.from(selectedEntries)[0]
      const entry = entries.find(e => e.id === entryId)
      if (entry) {
        setEditingEntry(entry)
        setShowForm(true)
        setSelectedEntries(new Set())
      }
    } else if (selectedEntries.size > 1) {
      alert("Please select only one entry to edit")
    } else {
      alert("Please select an entry to edit")
    }
  }

  const handleDelete = async (entryId: string) => {
    if (!confirm("Are you sure you want to delete this timesheet entry?")) {
      return
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/timesheet/${entryId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete entry")
      }

      handleRefresh()
      router.refresh()
    } catch (err) {
      console.error("Failed to delete entry:", err)
      alert("Failed to delete entry. Please try again.")
    }
  }

  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0)
  const totalAmount = entries.reduce((sum, entry) => sum + (entry.hours * (entry.rate ?? 0)), 0)
  const billableHours = entries.filter(e => e.billable).reduce((sum, entry) => sum + entry.hours, 0)
  const billableAmount = entries.filter(e => e.billable).reduce((sum, entry) => sum + (entry.hours * (entry.rate ?? 0)), 0)

  return (
    <>
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Timesheet Entries</CardTitle>
            <div className="flex items-center gap-2">
              {selectedEntries.size > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditSelected}
                    disabled={selectedEntries.size !== 1}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Selected
                  </Button>
                </>
              )}
              {users.length > 0 && (
                <Button onClick={() => { setEditingEntry(null); setShowForm(true) }} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Entry
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading...</p>
          ) : entries.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No timesheet entries yet</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 w-12">
                        <input
                          type="checkbox"
                          checked={selectedEntries.size === entries.length && entries.length > 0}
                          onChange={handleSelectAll}
                          className="cursor-pointer"
                        />
                      </th>
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Person</th>
                      <th className="text-right p-2">Hours</th>
                      <th className="text-right p-2">Rate</th>
                      <th className="text-right p-2">Amount</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-center p-2">Billable</th>
                      <th className="text-center p-2">Billed</th>
                      <th className="text-right p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-b">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={selectedEntries.has(entry.id)}
                            onChange={() => handleToggleSelect(entry.id)}
                            className="cursor-pointer"
                          />
                        </td>
                        <td className="p-2">{formatDate(entry.date)}</td>
                        <td className="p-2">{entry.user.name}</td>
                        <td className="p-2 text-right">{entry.hours.toFixed(2)}</td>
                        <td className="p-2 text-right">{formatCurrency(entry.rate ?? 0)}</td>
                        <td className="p-2 text-right">{formatCurrency(entry.hours * (entry.rate ?? 0))}</td>
                        <td className="p-2">{entry.description || "-"}</td>
                        <td className="p-2 text-center">
                          {entry.billable ? (
                            <span className="text-green-600">Yes</span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {entry.billed ? (
                            <span className="text-blue-600">Yes</span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { 
                                setEditingEntry(entry); 
                                setShowForm(true);
                                setSelectedEntries(new Set());
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(entry.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td colSpan={3} className="p-2">Total</td>
                      <td className="p-2 text-right">{totalHours.toFixed(2)}</td>
                      <td className="p-2 text-right">-</td>
                      <td className="p-2 text-right">{formatCurrency(totalAmount)}</td>
                      <td colSpan={5}></td>
                    </tr>
                    <tr className="border-t">
                      <td colSpan={3} className="p-2 text-sm text-gray-600">Billable Total</td>
                      <td className="p-2 text-right text-sm text-gray-600">{billableHours.toFixed(2)}</td>
                      <td className="p-2 text-right text-sm text-gray-600">-</td>
                      <td className="p-2 text-right text-sm text-gray-600">{formatCurrency(billableAmount)}</td>
                      <td colSpan={5}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {showForm && users.length > 0 && (
        <TimesheetEntryForm
          projectId={projectId}
          entry={editingEntry}
          users={users}
          proposal={proposal}
          isOpen={showForm}
          onClose={() => { setShowForm(false); setEditingEntry(null) }}
          onSuccess={() => { handleRefresh(); router.refresh() }}
        />
      )}
    </>
  )
}

