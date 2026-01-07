"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { LeadStatus } from "@prisma/client"
import { sortedCountries } from "@/lib/countries"

export default function EditLeadPage() {
  const router = useRouter()
  const params = useParams()
  const leadId = params.id as string
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [areasOfLaw, setAreasOfLaw] = useState<Array<{ id: string; name: string }>>([])
  const [sectorsOfActivity, setSectorsOfActivity] = useState<Array<{ id: string; name: string }>>([])
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
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
    // Fetch lead data and dropdown options
    Promise.all([
      fetch(`/api/leads/${leadId}`).then((res) => res.json()),
      fetch("/api/areas-of-law").then((res) => res.json()),
      fetch("/api/sectors-of-activity").then((res) => res.json()),
      fetch("/api/users").then((res) => res.json()),
    ])
      .then(([lead, areas, sectors, usersData]) => {
        if (lead.error) {
          setError(lead.error)
          return
        }

        setFormData({
          name: lead.name || "",
          email: lead.email || "",
          company: lead.company || "",
          phone: lead.phone || "",
          contactInfo: lead.contactInfo || "",
          addressLine: lead.addressLine || "",
          city: lead.city || "",
          state: lead.state || "",
          zipCode: lead.zipCode || "",
          country: lead.country || "",
          status: lead.status || LeadStatus.NEW,
          areaOfLawId: lead.areaOfLawId || "",
          sectorOfActivityId: lead.sectorOfActivityId || "",
          leadManagerId: lead.leadManagerId || "",
        })

        setAreasOfLaw(areas)
        setSectorsOfActivity(sectors)
        setUsers(usersData.filter((u: any) => u.role !== "CLIENT"))
      })
      .catch((err) => {
        console.error("Error fetching lead:", err)
        setError("Failed to load lead data")
      })
      .finally(() => {
        setLoading(false)
      })
  }, [leadId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSaving(true)

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "PUT",
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
        throw new Error(data.error || "Failed to update lead")
      }

      router.push(`/dashboard/leads/${leadId}`)
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div>
        <p>Loading...</p>
      </div>
    )
  }

  if (error && !formData.name) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Edit Lead</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit Lead</h1>
        <p className="text-gray-600 mt-2">Update lead information</p>
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
                  <Label htmlFor="areaOfLawId">Area of Law</Label>
                  <Select
                    id="areaOfLawId"
                    value={formData.areaOfLawId}
                    onChange={(e) => setFormData({ ...formData, areaOfLawId: e.target.value })}
                  >
                    <option value="">No area selected</option>
                    {areasOfLaw.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sectorOfActivityId">Sector of Activity</Label>
                  <Select
                    id="sectorOfActivityId"
                    value={formData.sectorOfActivityId}
                    onChange={(e) => setFormData({ ...formData, sectorOfActivityId: e.target.value })}
                  >
                    <option value="">No sector selected</option>
                    {sectorsOfActivity.map((sector) => (
                      <option key={sector.id} value={sector.id}>
                        {sector.name}
                      </option>
                    ))}
                  </Select>
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
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}



