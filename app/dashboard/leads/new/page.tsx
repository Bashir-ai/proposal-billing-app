"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { LeadStatus } from "@prisma/client"
import { sortedCountries } from "@/lib/countries"
import { Plus, Trash2, X } from "lucide-react"

export default function NewLeadPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [areasOfLaw, setAreasOfLaw] = useState<Array<{ id: string; name: string }>>([])
  const [sectorsOfActivity, setSectorsOfActivity] = useState<Array<{ id: string; name: string }>>([])
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [showCreateArea, setShowCreateArea] = useState(false)
  const [showCreateSector, setShowCreateSector] = useState(false)
  const [newAreaName, setNewAreaName] = useState("")
  const [newSectorName, setNewSectorName] = useState("")
  const [creatingArea, setCreatingArea] = useState(false)
  const [creatingSector, setCreatingSector] = useState(false)
  const [formData, setFormData] = useState<{
    name: string
    email: string
    company: string
    phone: string
    contactInfo: string
    addressLine: string
    city: string
    state: string
    zipCode: string
    country: string
    status: LeadStatus
    areaOfLawId: string
    sectorOfActivityId: string
    leadManagerId: string
  }>({
    name: "",
    email: "",
    company: "",
    phone: "",
    contactInfo: "",
    addressLine: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    status: LeadStatus.NEW,
    areaOfLawId: "",
    sectorOfActivityId: "",
    leadManagerId: "",
  })

  useEffect(() => {
    // Fetch areas of law, sectors, and users
    Promise.all([
      fetch("/api/areas-of-law").then((res) => res.json()),
      fetch("/api/sectors-of-activity").then((res) => res.json()),
      fetch("/api/users").then((res) => res.json()),
    ])
      .then(([areas, sectors, usersData]) => {
        setAreasOfLaw(areas)
        setSectorsOfActivity(sectors)
        setUsers(usersData.filter((u: any) => u.role !== "CLIENT"))
      })
      .catch(console.error)
  }, [])

  const fetchAreasOfLaw = async () => {
    try {
      const response = await fetch("/api/areas-of-law")
      if (response.ok) {
        const data = await response.json()
        setAreasOfLaw(data)
      }
    } catch (err) {
      console.error("Error fetching areas of law:", err)
    }
  }

  const fetchSectorsOfActivity = async () => {
    try {
      const response = await fetch("/api/sectors-of-activity")
      if (response.ok) {
        const data = await response.json()
        setSectorsOfActivity(data)
      }
    } catch (err) {
      console.error("Error fetching sectors of activity:", err)
    }
  }

  const handleCreateArea = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!newAreaName.trim()) return

    setCreatingArea(true)
    try {
      const response = await fetch("/api/areas-of-law", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newAreaName.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create area of law")
      }

      const newArea = await response.json()
      await fetchAreasOfLaw()
      setFormData(prev => ({ ...prev, areaOfLawId: newArea.id }))
      setNewAreaName("")
      setShowCreateArea(false)
    } catch (err: any) {
      alert(err.message || "Failed to create area of law")
    } finally {
      setCreatingArea(false)
    }
  }

  const handleDeleteArea = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return

    try {
      const response = await fetch(`/api/areas-of-law/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete area of law")
      }

      await fetchAreasOfLaw()
      setFormData(prev => prev.areaOfLawId === id ? { ...prev, areaOfLawId: "" } : prev)
    } catch (err: any) {
      alert(err.message || "Failed to delete area of law")
    }
  }

  const handleCreateSector = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!newSectorName.trim()) return

    setCreatingSector(true)
    try {
      const response = await fetch("/api/sectors-of-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSectorName.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create sector of activity")
      }

      const newSector = await response.json()
      await fetchSectorsOfActivity()
      setFormData(prev => ({ ...prev, sectorOfActivityId: newSector.id }))
      setNewSectorName("")
      setShowCreateSector(false)
    } catch (err: any) {
      alert(err.message || "Failed to create sector of activity")
    } finally {
      setCreatingSector(false)
    }
  }

  const handleDeleteSector = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return

    try {
      const response = await fetch(`/api/sectors-of-activity/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete sector of activity")
      }

      await fetchSectorsOfActivity()
      setFormData(prev => prev.sectorOfActivityId === id ? { ...prev, sectorOfActivityId: "" } : prev)
    } catch (err: any) {
      alert(err.message || "Failed to delete sector of activity")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          email: formData.email || null,
          company: formData.company || null,
          phone: formData.phone || null,
          contactInfo: formData.contactInfo || null,
          addressLine: formData.addressLine || null,
          city: formData.city || null,
          state: formData.state || null,
          zipCode: formData.zipCode || null,
          country: formData.country || null,
          areaOfLawId: formData.areaOfLawId || null,
          sectorOfActivityId: formData.sectorOfActivityId || null,
          leadManagerId: formData.leadManagerId || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create lead")
      }

      const lead = await response.json()
      router.push(`/dashboard/leads/${lead.id}`)
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create New Lead</h1>
        <p className="text-gray-600 mt-2">Add a new potential client to track</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactInfo">Additional Contact Info</Label>
                <Textarea
                  id="contactInfo"
                  value={formData.contactInfo}
                  onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader>
              <CardTitle>Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="addressLine">Address Line</Label>
                <Input
                  id="addressLine"
                  value={formData.addressLine}
                  onChange={(e) => setFormData({ ...formData, addressLine: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zipCode">Zip Code</Label>
                  <Input
                    id="zipCode"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                >
                  <option value="">Select a country</option>
                  {sortedCountries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Lead Details */}
          <Card>
            <CardHeader>
              <CardTitle>Lead Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as LeadStatus })}
                  >
                    {Object.values(LeadStatus).map((status) => (
                      <option key={status} value={status}>
                        {status.replace("_", " ")}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leadManagerId">Lead Manager</Label>
                  <Select
                    id="leadManagerId"
                    value={formData.leadManagerId}
                    onChange={(e) => setFormData({ ...formData, leadManagerId: e.target.value })}
                  >
                    <option value="">No manager assigned</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="areaOfLawId">Area of Law</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCreateArea(!showCreateArea)}
                      className="h-8 w-8 p-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {showCreateArea && (
                    <Card className="mb-2 p-3">
                      <div className="flex gap-2">
                        <Input
                          value={newAreaName}
                          onChange={(e) => setNewAreaName(e.target.value)}
                          placeholder="Area name"
                          required
                          autoFocus
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newAreaName.trim()) {
                              e.preventDefault()
                              handleCreateArea(e as any)
                            }
                          }}
                        />
                        <Button 
                          type="button" 
                          size="sm" 
                          disabled={creatingArea || !newAreaName.trim()}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleCreateArea(e as any)
                          }}
                        >
                          {creatingArea ? "..." : "Create"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setShowCreateArea(false)
                            setNewAreaName("")
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  )}
                  <div className="flex gap-2">
                    <Select
                      id="areaOfLawId"
                      value={formData.areaOfLawId}
                      onChange={(e) => setFormData({ ...formData, areaOfLawId: e.target.value })}
                      className="flex-1"
                    >
                      <option value="">No area selected</option>
                      {areasOfLaw.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </Select>
                    {formData.areaOfLawId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const area = areasOfLaw.find((a) => a.id === formData.areaOfLawId)
                          if (area) {
                            handleDeleteArea(area.id, area.name)
                          }
                        }}
                        className="px-3"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sectorOfActivityId">Sector of Activity</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCreateSector(!showCreateSector)}
                      className="h-8 w-8 p-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {showCreateSector && (
                    <Card className="mb-2 p-3">
                      <div className="flex gap-2">
                        <Input
                          value={newSectorName}
                          onChange={(e) => setNewSectorName(e.target.value)}
                          placeholder="Sector name"
                          required
                          autoFocus
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newSectorName.trim()) {
                              e.preventDefault()
                              handleCreateSector(e as any)
                            }
                          }}
                        />
                        <Button 
                          type="button" 
                          size="sm" 
                          disabled={creatingSector || !newSectorName.trim()}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleCreateSector(e as any)
                          }}
                        >
                          {creatingSector ? "..." : "Create"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setShowCreateSector(false)
                            setNewSectorName("")
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  )}
                  <div className="flex gap-2">
                    <Select
                      id="sectorOfActivityId"
                      value={formData.sectorOfActivityId}
                      onChange={(e) => setFormData({ ...formData, sectorOfActivityId: e.target.value })}
                      className="flex-1"
                    >
                      <option value="">No sector selected</option>
                      {sectorsOfActivity.map((sector) => (
                        <option key={sector.id} value={sector.id}>
                          {sector.name}
                        </option>
                      ))}
                    </Select>
                    {formData.sectorOfActivityId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const sector = sectorsOfActivity.find((s) => s.id === formData.sectorOfActivityId)
                          if (sector) {
                            handleDeleteSector(sector.id, sector.name)
                          }
                        }}
                        className="px-3"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex space-x-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Lead"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}

