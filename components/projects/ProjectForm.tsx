"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ProjectStatus } from "@prisma/client"
import { ProjectManagersSection } from "./ProjectManagersSection"
import { ProjectBillingConfig } from "./ProjectBillingConfig"
import { useRouter } from "next/navigation"

interface ProjectFormProps {
  projectId: string
  initialData?: {
    id: string
    name: string
    description?: string | null
    status: ProjectStatus
    startDate?: string | null
    endDate?: string | null
    currency: string
    useBlendedRate?: boolean | null
    blendedRate?: number | null
    hourlyRateTableType?: string | null
    hourlyRateTableRates?: any
    hourlyRateRangeMin?: number | null
    hourlyRateRangeMax?: number | null
    projectManagers?: Array<{
      id: string
      userId: string
      user: {
        id: string
        name: string
        email: string
        role: string
      }
    }>
    userRates?: Array<{
      id: string
      userId: string
      rate: number
      user: {
        id: string
        name: string
        email: string
        profile: string | null
        defaultHourlyRate: number | null
      }
    }>
    proposal?: {
      id: string
      type: string
      useBlendedRate?: boolean | null
      blendedRate?: number | null
      hourlyRateTableType?: string | null
      hourlyRateTableRates?: any
      hourlyRateRangeMin?: number | null
      hourlyRateRangeMax?: number | null
    } | null
  }
  users?: Array<{
    id: string
    name: string
    email: string
    profile: string | null
    defaultHourlyRate: number | null
  }>
}

type TabType = "details" | "managers" | "billing"

export function ProjectForm({ projectId, initialData, users = [] }: ProjectFormProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>("details")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    description: initialData?.description || "",
    status: (initialData?.status || "ACTIVE") as ProjectStatus,
    startDate: initialData?.startDate 
      ? new Date(initialData.startDate).toISOString().split("T")[0]
      : "",
    endDate: initialData?.endDate
      ? new Date(initialData.endDate).toISOString().split("T")[0]
      : "",
    currency: initialData?.currency || "EUR",
    // Billing configuration
    useBlendedRate: initialData?.useBlendedRate ?? false,
    blendedRate: initialData?.blendedRate || 0,
    hourlyRateTableType: initialData?.hourlyRateTableType || null,
    hourlyRateTableRates: initialData?.hourlyRateTableRates 
      ? (typeof initialData.hourlyRateTableRates === 'string' 
          ? JSON.parse(initialData.hourlyRateTableRates)
          : initialData.hourlyRateTableRates)
      : null,
    hourlyRateRangeMin: initialData?.hourlyRateRangeMin || 0,
    hourlyRateRangeMax: initialData?.hourlyRateRangeMax || 0,
  })

  const [userRates, setUserRates] = useState<Array<{
    userId: string
    rate: number
  }>>(
    initialData?.userRates?.map(ur => ({
      userId: ur.userId,
      rate: ur.rate,
    })) || []
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Update project basic fields
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          status: formData.status,
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
          useBlendedRate: formData.useBlendedRate,
          blendedRate: formData.blendedRate || null,
          hourlyRateTableType: formData.hourlyRateTableType,
          hourlyRateTableRates: formData.hourlyRateTableRates,
          hourlyRateRangeMin: formData.hourlyRateRangeMin || null,
          hourlyRateRangeMax: formData.hourlyRateRangeMax || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update project")
      }

      // Update user rates
      const currentUserRates = initialData?.userRates || []
      const currentUserRateMap = new Map(
        currentUserRates.map(ur => [ur.userId, ur.rate])
      )

      // Add or update user rates
      for (const userRate of userRates) {
        const currentRate = currentUserRateMap.get(userRate.userId)
        if (currentRate !== userRate.rate) {
          await fetch(`/api/projects/${projectId}/user-rates`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: userRate.userId,
              rate: userRate.rate,
            }),
          })
        }
      }

      // Remove user rates that are no longer in the list
      const newUserRateMap = new Map(userRates.map(ur => [ur.userId, ur.rate]))
      for (const currentUserRate of currentUserRates) {
        if (!newUserRateMap.has(currentUserRate.userId)) {
          await fetch(`/api/projects/${projectId}/user-rates?userId=${currentUserRate.userId}`, {
            method: "DELETE",
          })
        }
      }

      setSuccess("Project updated successfully")
      setTimeout(() => {
        router.refresh()
      }, 1000)
    } catch (err: any) {
      console.error("Error updating project:", err)
      setError(err.message || "Failed to update project")
    } finally {
      setLoading(false)
    }
  }

  const tabs: Array<{ id: TabType; label: string }> = [
    { id: "details", label: "Details" },
    { id: "managers", label: "Managers" },
    { id: "billing", label: "Billing" },
  ]

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* Tab Content */}
      {activeTab === "details" && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
              <CardDescription>Basic information about the project</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="CANCELLED">Cancelled</option>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      )}

      {activeTab === "managers" && (
        <ProjectManagersSection
          projectId={projectId}
          initialManagers={initialData?.projectManagers}
        />
      )}

      {activeTab === "billing" && (
        <ProjectBillingConfig
          projectId={projectId}
          formData={formData}
          setFormData={setFormData}
          userRates={userRates}
          setUserRates={setUserRates}
          users={users}
          proposal={initialData?.proposal || null}
          onSave={handleSubmit}
          loading={loading}
        />
      )}
    </div>
  )
}
