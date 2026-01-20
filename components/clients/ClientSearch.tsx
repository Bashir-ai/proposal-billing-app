"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Search } from "lucide-react"
import { useDebouncedCallback } from "use-debounce"
import { useEffect, useState } from "react"

export function ClientSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchValue, setSearchValue] = useState(searchParams.get("search") || "")
  const [sortValue, setSortValue] = useState(searchParams.get("sort") || "name")

  const handleSearch = useDebouncedCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set("search", value)
    } else {
      params.delete("search")
    }
    router.push(`/dashboard/clients?${params.toString()}`)
  }, 300)

  const handleSortChange = (value: string) => {
    setSortValue(value)
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== "name") {
      params.set("sort", value)
    } else {
      params.delete("sort")
    }
    router.push(`/dashboard/clients?${params.toString()}`)
  }

  useEffect(() => {
    // Sync with URL params on mount
    const urlSearch = searchParams.get("search") || ""
    const urlSort = searchParams.get("sort") || "name"
    setSearchValue(urlSearch)
    setSortValue(urlSort)
  }, [searchParams])

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search clients..."
          className="pl-10"
          value={searchValue}
          onChange={(e) => {
            const value = e.target.value
            setSearchValue(value)
            handleSearch(value)
          }}
        />
      </div>
      <div className="flex items-center gap-2 sm:w-64">
        <Label htmlFor="sort" className="whitespace-nowrap text-sm">Sort by:</Label>
        <Select
          id="sort"
          value={sortValue}
          onChange={(e) => handleSortChange(e.target.value)}
          className="flex-1"
        >
          <option value="name">Name (A-Z)</option>
          <option value="most-used">Most Used</option>
          <option value="number">Number</option>
        </Select>
      </div>
    </div>
  )
}

