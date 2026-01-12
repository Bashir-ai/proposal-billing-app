"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { formatDate } from "@/lib/utils"
import { Plus, X, Check, XCircle } from "lucide-react"

interface EligibilityRecord {
  id: string
  compensationId: string
  projectId: string | null
  clientId: string | null
  billId: string | null
  isEligible: boolean
  createdAt: string
  compensation: {
    id: string
    compensationType: string
    percentageType: string | null
    projectPercentage: number | null
    directWorkPercentage: number | null
  }
  project?: {
    id: string
    name: string
  } | null
  client?: {
    id: string
    name: string
    company: string | null
  } | null
  bill?: {
    id: string
    invoiceNumber: string | null
    amount: number
  } | null
}

interface Compensation {
  id: string
  compensationType: string
  percentageType: string | null
  projectPercentage: number | null
  directWorkPercentage: number | null
  effectiveFrom: string
  effectiveTo: string | null
}

interface CompensationEligibilityManagerProps {
  userId?: string // Optional - if not provided, show user selector
  projectId?: string
  clientId?: string
  billId?: string
  isAdmin: boolean
}

interface User {
  id: string
  name: string
  email: string
}

export function CompensationEligibilityManager({
  userId: propUserId,
  projectId,
  clientId,
  billId,
  isAdmin,
}: CompensationEligibilityManagerProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>(propUserId || "")
  const [users, setUsers] = useState<User[]>([])
  const [eligibility, setEligibility] = useState<EligibilityRecord[]>([])
  const [compensations, setCompensations] = useState<Compensation[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedCompensationId, setSelectedCompensationId] = useState<string>("")
  const [isEligible, setIsEligible] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isAdmin) {
      if (!propUserId) {
        fetchUsers()
      } else {
        setSelectedUserId(propUserId)
      }
    }
  }, [isAdmin, propUserId])

  useEffect(() => {
    if (isAdmin && selectedUserId) {
      fetchEligibility()
      fetchCompensations()
    }
  }, [selectedUserId, projectId, clientId, billId, isAdmin])

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users")
      if (response.ok) {
        const data = await response.json()
        setUsers(data.filter((u: User) => u.role !== "CLIENT"))
      }
    } catch (error) {
      console.error("Error fetching users:", error)
    }
  }

  const fetchEligibility = async () => {
    if (!selectedUserId) return
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (projectId) params.set("projectId", projectId)
      if (clientId) params.set("clientId", clientId)
      if (billId) params.set("billId", billId)

      const response = await fetch(`/api/users/${selectedUserId}/compensation/eligibility?${params.toString()}`)
      const data = await response.json()
      setEligibility(data.eligibility || [])
    } catch (error) {
      console.error("Error fetching eligibility:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCompensations = async () => {
    if (!selectedUserId) return
    try {
      const response = await fetch(`/api/users/${selectedUserId}/compensation`)
      const data = await response.json()
      if (data.compensation) {
        // Get all active compensations (percentage-based only)
        const activeCompensations = [data.compensation].filter(
          (c: Compensation) =>
            c.compensationType === "PERCENTAGE_BASED" &&
            new Date(c.effectiveFrom) <= new Date() &&
            (c.effectiveTo === null || new Date(c.effectiveTo) >= new Date())
        )
        setCompensations(activeCompensations)
      }
    } catch (error) {
      console.error("Error fetching compensations:", error)
    }
  }

  const handleAdd = () => {
    setSelectedCompensationId("")
    setIsEligible(true)
    setShowAddModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCompensationId) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/users/${selectedUserId}/compensation/eligibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compensationId: selectedCompensationId,
          projectId: projectId || null,
          clientId: clientId || null,
          billId: billId || null,
          isEligible,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || "Failed to save eligibility")
        return
      }

      setShowAddModal(false)
      await fetchEligibility()
    } catch (error) {
      console.error("Error saving eligibility:", error)
      alert("Failed to save eligibility")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (eligibilityId: string) => {
    if (!confirm("Are you sure you want to remove this eligibility record?")) return

    try {
      const response = await fetch(`/api/users/${selectedUserId}/compensation/eligibility/${eligibilityId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || "Failed to delete eligibility")
        return
      }

      await fetchEligibility()
    } catch (error) {
      console.error("Error deleting eligibility:", error)
      alert("Failed to delete eligibility")
    }
  }

  if (!isAdmin) {
    return null
  }

  const scopeLabel = projectId
    ? "Project"
    : clientId
    ? "Client"
    : billId
    ? "Invoice"
    : ""

  if (!propUserId && !selectedUserId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compensation Eligibility</CardTitle>
          <CardDescription>
            Manage which percentage-based compensations apply to this {scopeLabel.toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Select User</Label>
            <Select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">Select a user</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return <div>Loading eligibility...</div>
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Compensation Eligibility</CardTitle>
            <CardDescription>
              Manage which percentage-based compensations apply to this {scopeLabel.toLowerCase()}
            </CardDescription>
          </div>
          {compensations.length > 0 && (
            <Button onClick={handleAdd} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Eligibility
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {compensations.length === 0 ? (
          <p className="text-sm text-gray-500">
            No percentage-based compensation configured for this user. Configure compensation in Settings → User Management.
          </p>
        ) : eligibility.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              No eligibility records for this {scopeLabel.toLowerCase()}. By default, all percentage-based compensations apply.
            </p>
            <p className="text-xs text-gray-400">
              Add an eligibility record to explicitly include or exclude this {scopeLabel.toLowerCase()} from compensation calculations.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {eligibility.map((record) => {
              const comp = record.compensation
              return (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {record.isEligible ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="font-semibold">
                        {comp.percentageType === "PROJECT_TOTAL" && comp.projectPercentage
                          ? `${comp.projectPercentage}% of Project Total`
                          : comp.percentageType === "DIRECT_WORK" && comp.directWorkPercentage
                          ? `${comp.directWorkPercentage}% of Direct Work`
                          : comp.percentageType === "BOTH"
                          ? `${comp.projectPercentage}% Project + ${comp.directWorkPercentage}% Direct`
                          : "Percentage-Based"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          record.isEligible
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {record.isEligible ? "Eligible" : "Excluded"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Created {formatDate(record.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(record.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md m-4">
              <CardHeader>
                <CardTitle>Add Eligibility Record</CardTitle>
                <CardDescription>
                  Set whether this {scopeLabel.toLowerCase()} is included in compensation calculations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Compensation *</Label>
                    <Select
                      value={selectedCompensationId}
                      onChange={(e) => setSelectedCompensationId(e.target.value)}
                      required
                    >
                      <option value="">Select compensation</option>
                      {compensations.map((comp) => (
                        <option key={comp.id} value={comp.id}>
                          {comp.percentageType === "PROJECT_TOTAL" && comp.projectPercentage
                            ? `${comp.projectPercentage}% of Project Total`
                            : comp.percentageType === "DIRECT_WORK" && comp.directWorkPercentage
                            ? `${comp.directWorkPercentage}% of Direct Work`
                            : comp.percentageType === "BOTH"
                            ? `${comp.projectPercentage}% Project + ${comp.directWorkPercentage}% Direct`
                            : "Percentage-Based"}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Eligibility Status *</Label>
                    <Select
                      value={isEligible ? "true" : "false"}
                      onChange={(e) => setIsEligible(e.target.value === "true")}
                      required
                    >
                      <option value="true">Eligible (Include in calculations)</option>
                      <option value="false">Excluded (Exclude from calculations)</option>
                    </Select>
                  </div>

                  <div className="flex justify-end gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting || !selectedCompensationId}>
                      {submitting ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
