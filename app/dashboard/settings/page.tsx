"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { UserManagement } from "@/components/settings/UserManagement"
import { JunkBox } from "@/components/settings/JunkBox"
import { LogoUpload } from "@/components/settings/LogoUpload"
import { canCreateUsers } from "@/lib/permissions"

export default function SettingsPage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [hourlyRate, setHourlyRate] = useState<string>("")

  useEffect(() => {
    if (session?.user?.id) {
      fetch(`/api/users/${session.user.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.defaultHourlyRate) {
            setHourlyRate(data.defaultHourlyRate.toString())
          }
        })
        .catch(console.error)
    }
  }, [session])

  if (!session) {
    router.push("/login")
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setSaving(true)

    try {
      const response = await fetch(`/api/users/${session.user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultHourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Failed to update hourly rate")
      } else {
        setSuccess("Hourly rate updated successfully")
        await update() // Refresh session
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600">Name</label>
            <p className="mt-1">{session.user.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Email</label>
            <p className="mt-1">{session.user.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Role</label>
            <p className="mt-1">{session.user.role}</p>
          </div>
        </CardContent>
      </Card>

      {(session.user.role === "ADMIN" || session.user.role === "MANAGER" || session.user.role === "STAFF") && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Hourly Rate</CardTitle>
            <CardDescription>Set your default hourly rate for proposals</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="hourlyRate">Default Hourly Rate ($/hr)</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500">
                  This rate will be used as the default when you are selected for hourly billing in proposals.
                </p>
              </div>
              {error && (
                <div className="text-sm text-destructive">{error}</div>
              )}
              {success && (
                <div className="text-sm text-green-600">{success}</div>
              )}
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Hourly Rate"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {session.user.role === "ADMIN" && (
        <>
          <LogoUpload />
          
          <UserManagement />
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Junk Box</CardTitle>
              <CardDescription>
                Recover or permanently delete proposals, projects, and invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <JunkBox />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
