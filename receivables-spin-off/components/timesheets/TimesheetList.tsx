"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { formatDate, formatCurrency, formatClientName, cn } from "@/lib/utils"
import { Clock, DollarSign, Trash2, Pencil } from "lucide-react"
import Link from "next/link"
import { TimesheetEntryForm } from "@/components/projects/TimesheetEntryForm"

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
  const router = useRouter()
  const [timesheetEntries, setTimesheetEntries] = useState<TimesheetEntry[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(initialFilters || {})
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null)
  const [showEditForm, setShowEditForm] = useState(false)
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; defaultHourlyRate?: number | null }>>([])
  const [proposals, setProposals] = useState<Map<string, any>>(new Map())
  
  const isAdmin = userRole === "ADMIN"
  const isManagerOrStaff = userRole === "MANAGER" || userRole === "STAFF"

  // Fetch users for the edit form
  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        const staffUsers = data.filter((user: any) => user.role !== "CLIENT")
        setUsers(staffUsers)
      })
      .catch(console.error)
  }, [])

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
        
        // Fetch proposal data for each unique project to support edit form
        const entries = (data.timesheetEntries || []) as TimesheetEntry[]
        const projectIds: string[] = [...new Set(entries.map((e) => e.project.id))]
        const proposalMap = new Map<string, any>()
        await Promise.all(
          projectIds.map(async (projectId: string) => {
            try {
              const projectRes = await fetch(`/api/projects/${projectId}`)
              if (projectRes.ok) {
                const projectData = await projectRes.json()
                if (projectData.proposal) {
                  proposalMap.set(projectId, {
                    id: projectData.proposal.id,
                    useBlendedRate: projectData.proposal.useBlendedRate || false,
                    blendedRate: projectData.proposal.blendedRate,
                    items: projectData.proposal.items?.map((item: any) => ({
                      id: item.id,
                      personId: item.personId,
                      rate: item.rate,
                    })) || [],
                  })
                }
              }
            } catch (err) {
              console.error(`Error fetching proposal for project ${projectId}:`, err)
            }
          })
        )
        setProposals(proposalMap)
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

  // Filter only timesheet entries for bulk deletion
  const timesheetItems = useMemo(() => {
    return allItems.filter((item) => item.type === "timesheet") as TimesheetEntry[]
  }, [allItems])

  const handleToggle = (entryId: string) => {
    const newSelected = new Set(selectedEntryIds)
    if (newSelected.has(entryId)) {
      newSelected.delete(entryId)
    } else {
      newSelected.add(entryId)
    }
    setSelectedEntryIds(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedEntryIds.size === timesheetItems.length && timesheetItems.length > 0) {
      setSelectedEntryIds(new Set())
    } else {
      setSelectedEntryIds(new Set(timesheetItems.map((item) => item.id)))
    }
  }

  const handleIndividualDelete = async (entryId: string, projectId: string) => {
    if (!confirm("Are you sure you want to delete this timesheet entry?")) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/timesheet/${entryId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete timesheet entry")
      }

      fetchData() // Refresh data
      alert("Timesheet entry deleted successfully")
    } catch (error) {
      console.error("Error deleting timesheet entry:", error)
      alert(error instanceof Error ? error.message : "Failed to delete timesheet entry. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleEdit = (entry: TimesheetEntry) => {
    setEditingEntry(entry)
    setShowEditForm(true)
  }

  const handleEditSuccess = () => {
    setShowEditForm(false)
    setEditingEntry(null)
    fetchData() // Refresh data
    router.refresh()
  }

  const handleBulkDelete = async () => {
    if (selectedEntryIds.size === 0) return

    if (!confirm(`Are you sure you want to delete ${selectedEntryIds.size} timesheet entr${selectedEntryIds.size !== 1 ? "ies" : "y"}?`)) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch("/api/timesheets/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entryIds: Array.from(selectedEntryIds),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete timesheet entries")
      }

      const result = await response.json()
      setSelectedEntryIds(new Set())
      router.refresh()
      alert(result.message || `Successfully deleted ${selectedEntryIds.size} timesheet entr${selectedEntryIds.size !== 1 ? "ies" : "y"}`)
    } catch (error) {
      console.error("Error deleting timesheet entries:", error)
      alert(error instanceof Error ? error.message : "Failed to delete timesheet entries. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

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
          <CardTitle>Timesheet Entries & Charges</CardTitle>
          {isAdmin && timesheetItems.length > 0 && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedEntryIds.size === timesheetItems.length && timesheetItems.length > 0}
                  onCheckedChange={handleSelectAll}
                  disabled={timesheetItems.length === 0 || isDeleting}
                />
                <span className="text-sm text-gray-600">
                  Select all ({timesheetItems.length} entries)
                </span>
              </div>
              {selectedEntryIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedEntryIds.size})
                </Button>
              )}
            </div>
          )}
        </div>
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
                  {isAdmin && <th className="text-left p-2 w-12"></th>}
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
                  {isAdmin && <th className="text-center p-2 w-20">Actions</th>}
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
                          !entry.billed && entry.billable && "bg-blue-50",
                          selectedEntryIds.has(entry.id) && "bg-blue-100"
                        )}
                      >
                        {(isAdmin || isManagerOrStaff) && (
                          <td className="p-2">
                            {isAdmin && (
                              <Checkbox
                                checked={selectedEntryIds.has(entry.id)}
                                onCheckedChange={() => handleToggle(entry.id)}
                                disabled={isDeleting}
                              />
                            )}
                          </td>
                        )}
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
                        {(isAdmin || (isManagerOrStaff && entry.user.id === currentUserId)) && (
                          <td className="p-2 text-center">
                            <div className="flex justify-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleEdit(entry)
                                }}
                                disabled={isDeleting}
                                className="h-8 w-8 p-0"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              {(isAdmin || entry.user.id === currentUserId) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleIndividualDelete(entry.id, entry.project.id)
                                  }}
                                  disabled={isDeleting}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
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
                        {(isAdmin || isManagerOrStaff) && <td className="p-2"></td>}
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
                        <td className="p-2">{formatClientName(charge.project.client)}</td>
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
                        {(isAdmin || isManagerOrStaff) && <td className="p-2"></td>}
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
    {showEditForm && editingEntry && users.length > 0 && (
      <TimesheetEntryForm
        projectId={editingEntry.project.id}
        entry={{
          id: editingEntry.id,
          userId: editingEntry.user.id,
          date: editingEntry.date,
          hours: editingEntry.hours,
          rate: editingEntry.rate,
          description: editingEntry.description || "",
          billable: editingEntry.billable,
        }}
        users={users}
        proposal={proposals.get(editingEntry.project.id) || null}
        isOpen={showEditForm}
        onClose={() => {
          setShowEditForm(false)
          setEditingEntry(null)
        }}
        onSuccess={handleEditSuccess}
      />
    )}
    </>
  )
}
