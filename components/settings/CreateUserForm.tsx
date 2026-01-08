"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserRole } from "@prisma/client"

interface CreateUserFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function CreateUserForm({ onSuccess, onCancel }: CreateUserFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "STAFF" as UserRole,
    canApproveProposals: false,
    canApproveInvoices: false,
    canEditAllProposals: false,
    canEditAllInvoices: false,
    canViewAllClients: false,
    canCreateUsers: false,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          canApproveProposals: formData.canApproveProposals || null,
          canApproveInvoices: formData.canApproveInvoices || null,
          canEditAllProposals: formData.canEditAllProposals || null,
          canEditAllInvoices: formData.canEditAllInvoices || null,
          canViewAllClients: formData.canViewAllClients || null,
          canCreateUsers: formData.canCreateUsers || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create user")
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || "Failed to create user")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New User</CardTitle>
        <CardDescription>Add a new user with role and permission overrides</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <select
              id="role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            >
              <option value="STAFF">Staff</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
              <option value="CLIENT">Client</option>
            </select>
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
              {loading ? "Creating..." : "Create User"}
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






