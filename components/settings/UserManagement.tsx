"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CreateUserForm } from "./CreateUserForm"
import { EditUserForm } from "./EditUserForm"
import { formatDate } from "@/lib/utils"
import { Pencil } from "lucide-react"

interface User {
  id: string
  name: string
  email: string
  role: string
  canApproveProposals?: boolean | null
  canApproveInvoices?: boolean | null
  canEditAllProposals?: boolean | null
  canEditAllInvoices?: boolean | null
  canViewAllClients?: boolean | null
  canCreateUsers?: boolean | null
  createdAt: string
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/users")
      if (!response.ok) {
        throw new Error("Failed to fetch users")
      }
      const data = await response.json()
      // Filter out CLIENT role users - they have their own folder
      const filteredUsers = data.filter((user: User) => user.role !== "CLIENT")
      setUsers(filteredUsers)
    } catch (err: any) {
      setError(err.message || "Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  const handleUserCreated = () => {
    setShowCreateForm(false)
    fetchUsers()
  }

  const handleUserUpdated = () => {
    setEditingUserId(null)
    fetchUsers()
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">Loading users...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Manage users and their permissions</CardDescription>
          </div>
          <Button onClick={() => setShowCreateForm(true)}>
            Create New User
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm mb-4">
            {error}
          </div>
        )}

        {showCreateForm && (
          <div className="mb-6">
            <CreateUserForm
              onSuccess={handleUserCreated}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        )}

        <div className="space-y-4">
          {users.map((user) => (
            <div
              key={user.id}
              className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              {editingUserId === user.id ? (
                <EditUserForm
                  user={user}
                  onSuccess={handleUserUpdated}
                  onCancel={() => setEditingUserId(null)}
                />
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-semibold text-lg">{user.name}</h3>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                        {user.role.toLowerCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{user.email}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {user.canApproveProposals && (
                        <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                          Can Approve Proposals
                        </span>
                      )}
                      {user.canApproveInvoices && (
                        <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                          Can Approve Invoices
                        </span>
                      )}
                      {user.canEditAllProposals && (
                        <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">
                          Can Edit All Proposals
                        </span>
                      )}
                      {user.canEditAllInvoices && (
                        <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">
                          Can Edit All Invoices
                        </span>
                      )}
                      {user.canViewAllClients && (
                        <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                          Can View All Clients
                        </span>
                      )}
                      {user.canCreateUsers && (
                        <span className="px-2 py-1 rounded text-xs bg-orange-100 text-orange-800">
                          Can Create Users
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Created: {formatDate(new Date(user.createdAt))}
                    </p>
                  </div>
                  <div className="ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingUserId(user.id)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {users.length === 0 && (
          <div className="py-8 text-center text-gray-500">
            <p>No users found</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

