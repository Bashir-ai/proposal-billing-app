"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useDebouncedCallback } from "use-debounce"
import { LeadStatus } from "@prisma/client"

interface LeadSearchProps {
  areasOfLaw: Array<{ id: string; name: string }>
  sectorsOfActivity: Array<{ id: string; name: string }>
  initialStatus?: string
  initialAreaOfLawId?: string
  initialSectorOfActivityId?: string
  initialSearch?: string
  showArchived?: boolean
}

export function LeadSearch({
  areasOfLaw,
  sectorsOfActivity,
  initialStatus,
  initialAreaOfLawId,
  initialSectorOfActivityId,
  initialSearch = "",
  showArchived = false,
}: LeadSearchProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchValue, setSearchValue] = useState(initialSearch)
  const [statusValue, setStatusValue] = useState(initialStatus || "")
  const [areaOfLawValue, setAreaOfLawValue] = useState(initialAreaOfLawId || "")
  const [sectorValue, setSectorValue] = useState(initialSectorOfActivityId || "")
  const [archivedValue, setArchivedValue] = useState(showArchived)

  const debouncedSearch = useDebouncedCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set("search", value)
    } else {
      params.delete("search")
    }
    router.push(`/dashboard/leads?${params.toString()}`)
  }, 300)

  useEffect(() => {
    debouncedSearch(searchValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue])

  const handleFilterChange = () => {
    const params = new URLSearchParams()
    
    if (searchValue) params.set("search", searchValue)
    if (statusValue) params.set("status", statusValue)
    if (areaOfLawValue) params.set("areaOfLawId", areaOfLawValue)
    if (sectorValue) params.set("sectorOfActivityId", sectorValue)
    if (archivedValue) params.set("archived", "true")

    router.push(`/dashboard/leads?${params.toString()}`)
  }

  const handleClear = () => {
    setSearchValue("")
    setStatusValue("")
    setAreaOfLawValue("")
    setSectorValue("")
    setArchivedValue(false)
    router.push("/dashboard/leads")
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            placeholder="Search by name, email, or company..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="status">Status</Label>
          <Select
            id="status"
            value={statusValue}
            onChange={(e) => {
              setStatusValue(e.target.value)
              handleFilterChange()
            }}
          >
            <option value="">All Statuses</option>
            {Object.values(LeadStatus).map((status) => (
              <option key={status} value={status}>
                {status.replace("_", " ")}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="areaOfLaw">Area of Law</Label>
          <Select
            id="areaOfLaw"
            value={areaOfLawValue}
            onChange={(e) => {
              setAreaOfLawValue(e.target.value)
              handleFilterChange()
            }}
          >
            <option value="">All Areas</option>
            {areasOfLaw.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="sector">Sector</Label>
          <Select
            id="sector"
            value={sectorValue}
            onChange={(e) => {
              setSectorValue(e.target.value)
              handleFilterChange()
            }}
          >
            <option value="">All Sectors</option>
            {sectorsOfActivity.map((sector) => (
              <option key={sector.id} value={sector.id}>
                {sector.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={archivedValue}
            onChange={(e) => {
              setArchivedValue(e.target.checked)
              handleFilterChange()
            }}
            className="rounded"
          />
          <span className="text-sm">Show archived leads</span>
        </label>

        <Button variant="outline" size="sm" onClick={handleClear}>
          Clear Filters
        </Button>
      </div>
    </div>
  )
}

