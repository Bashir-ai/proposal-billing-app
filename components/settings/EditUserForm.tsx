"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserRole } from "@prisma/client"

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
  defaultHourlyRate?: number | null
}

interface EditUserFormProps {
  user: User
  onSuccess: () => void
  onCancel: () => void
}

export function EditUserForm({ user, onSuccess, onCancel }: EditUserFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    password: "",
    role: user.role as UserRole,
    canApproveProposals: user.canApproveProposals ?? false,
    canApproveInvoices: user.canApproveInvoices ?? false,
    canEditAllProposals: user.canEditAllProposals ?? false,
    canEditAllInvoices: user.canEditAllInvoices ?? false,
    canViewAllClients: user.canViewAllClients ?? false,
    canCreateUsers: user.canCreateUsers ?? false,
    defaultHourlyRate: user.defaultHourlyRate?.toString() || "",
  })

  useEffect(() => {
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role as UserRole,
      canApproveProposals: user.canApproveProposals ?? false,
      canApproveInvoices: user.canApproveInvoices ?? false,
      canEditAllProposals: user.canEditAllProposals ?? false,
      canEditAllInvoices: user.canEditAllInvoices ?? false,
      canViewAllClients: user.canViewAllClients ?? false,
      canCreateUsers: user.canCreateUsers ?? false,
      defaultHourlyRate: user.defaultHourlyRate?.toString() || "",
    })
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const updateData: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        canApproveProposals: formData.canApproveProposals || null,
        canApproveInvoices: formData.canApproveInvoices || null,
        canEditAllProposals: formData.canEditAllProposals || null,
        canEditAllInvoices: formData.canEditAllInvoices || null,
        canViewAllClients: formData.canViewAllClients || null,
        canCreateUsers: formData.canCreateUsers || null,
        defaultHourlyRate: formData.defaultHourlyRate ? parseFloat(formData.defaultHourlyRate) : null,
      }

      // Only include password if it's been changed
      if (formData.password) {
        updateData.password = formData.password
      }

      const response = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update user")
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || "Failed to update user")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit User</CardTitle>
        <CardDescription>Update user information and permissions</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email">Email *</Label>
            <Input
              id="edit-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-password">Password</Label>
            <Input
              id="edit-password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Leave blank to keep current password"
              minLength={6}
            />
            <p className="text-xs text-gray-500">
              Leave blank if you don't want to change the password
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-role">Role *</Label>
            <select
              id="edit-role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            >
              <option value="STAFF">Staff</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-hourly-rate">Default Hourly Rate</Label>
            <Input
              id="edit-hourly-rate"
              type="number"
              step="0.01"
              min="0"
              value={formData.defaultHourlyRate}
              onChange={(e) => setFormData({ ...formData, defaultHourlyRate: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-3 pt-4 border-t">
            <Label className="text-base font-semibold">Permission Overrides</Label>
            <p className="text-sm text-gray-600">
              Override default role permissions (leave unchecked to use role defaults)
            </p>
            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.canApproveProposals}
                  onChange={(e) => setFormData({ ...formData, canApproveProposals: e.target.checked })}
                  className="rounded"
                />
                <span>Can Approve Proposals</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.canApproveInvoices}
                  onChange={(e) => setFormData({ ...formData, canApproveInvoices: e.target.checked })}
                  className="rounded"
                />
                <span>Can Approve Invoices</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.canEditAllProposals}
                  onChange={(e) => setFormData({ ...formData, canEditAllProposals: e.target.checked })}
                  className="rounded"
                />
                <span>Can Edit All Proposals</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.canEditAllInvoices}
                  onChange={(e) => setFormData({ ...formData, canEditAllInvoices: e.target.checked })}
                  className="rounded"
                />
                <span>Can Edit All Invoices</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.canViewAllClients}
                  onChange={(e) => setFormData({ ...formData, canViewAllClients: e.target.checked })}
                  className="rounded"
                />
                <span>Can View All Clients</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.canCreateUsers}
                  onChange={(e) => setFormData({ ...formData, canCreateUsers: e.target.checked })}
                  className="rounded"
                />
                <span>Can Create Users (Admin only by default)</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}

          <div className="flex space-x-3">
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update User"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}



