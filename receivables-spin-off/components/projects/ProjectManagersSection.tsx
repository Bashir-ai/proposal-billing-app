"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Plus, X, User } from "lucide-react"
import { useSession } from "next-auth/react"

interface ProjectManager {
  id: string
  userId: string
  user: {
    id: string
    name: string
    email: string
    role: string
  }
}

interface ProjectManagersSectionProps {
  projectId: string
  initialManagers?: ProjectManager[]
}

export function ProjectManagersSection({
  projectId,
  initialManagers = [],
}: ProjectManagersSectionProps) {
  const { data: session } = useSession()
  const [managers, setManagers] = useState<ProjectManager[]>(Array.isArray(initialManagers) ? initialManagers : [])
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const canEdit = session?.user.role === "ADMIN" || session?.user.role === "MANAGER"

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/users")
      if (response.ok) {
        const data = await response.json()
        // Filter out clients
        setUsers(data.filter((user: any) => user.role !== "CLIENT"))
      }
    } catch (error) {
      console.error("Failed to fetch users:", error)
    }
  }, [])

  const fetchManagers = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/managers`)
      if (response.ok) {
        const data = await response.json()
        setManagers(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error("Failed to fetch managers:", error)
    }
  }, [projectId])

  useEffect(() => {
    fetchUsers()
    fetchManagers()
  }, [fetchUsers, fetchManagers])

  const handleAddManagers = async () => {
    if (selectedUserIds.length === 0) {
      setError("Please select at least one user")
      return
    }

    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const response = await fetch(`/api/projects/${projectId}/managers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selectedUserIds }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to add managers")
      }

      setSuccess("Managers added successfully")
      setSelectedUserIds([])
      setShowAddForm(false)
      fetchManagers()
    } catch (err: any) {
      setError(err.message || "Failed to add managers")
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveManager = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this project manager?")) {
      return
    }

    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const response = await fetch(`/api/projects/${projectId}/managers?userId=${userId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to remove manager")
      }

      setSuccess("Manager removed successfully")
      fetchManagers()
    } catch (err: any) {
      setError(err.message || "Failed to remove manager")
    } finally {
      setLoading(false)
    }
  }

  // Filter out users who are already managers
  const availableUsers = Array.isArray(users) ? users.filter(
    (user) => !(Array.isArray(managers) ? managers : []).some((manager) => manager.userId === user.id)
  ) : []

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Project Managers ({managers.length})</CardTitle>
            <CardDescription>
              Users responsible for managing this project
            </CardDescription>
          </div>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Manager
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
            {success}
          </div>
        )}

        {showAddForm && canEdit && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
            <Label htmlFor="add-managers">Select Users to Add as Managers</Label>
            <Select
              id="add-managers"
              multiple
              value={selectedUserIds}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, (option) => option.value)
                setSelectedUserIds(selected)
              }}
              className="mt-2"
            >
              {availableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </Select>
            {availableUsers.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">All available users are already managers</p>
            )}
            <div className="flex space-x-2 mt-4">
              <Button
                onClick={handleAddManagers}
                disabled={loading || selectedUserIds.length === 0}
                size="sm"
              >
                {loading ? "Adding..." : "Add Managers"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddForm(false)
                  setSelectedUserIds([])
                  setError("")
                }}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!Array.isArray(managers) || managers.length === 0 ? (
          <p className="text-sm text-gray-500">No project managers assigned</p>
        ) : (
          <div className="space-y-2">
            {managers.map((manager) => (
              <div
                key={manager.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <User className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium">{manager.user.name}</p>
                    <p className="text-sm text-gray-500">{manager.user.email}</p>
                    <span className="text-xs text-gray-400">{manager.user.role}</span>
                  </div>
                </div>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveManager(manager.userId)}
                    disabled={loading}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}



