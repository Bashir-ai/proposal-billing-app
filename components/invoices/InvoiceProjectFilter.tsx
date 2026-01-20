"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Select } from "@/components/ui/select"

interface InvoiceProjectFilterProps {
  projects: Array<{ id: string; name: string }>
}

export function InvoiceProjectFilter({ projects }: InvoiceProjectFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectIdParam = searchParams.get("projectId") || "ALL"

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    const params = new URLSearchParams(searchParams.toString())
    
    if (value === "ALL") {
      params.delete("projectId")
    } else {
      params.set("projectId", value)
    }
    
    router.push(`/dashboard/bills?${params.toString()}`)
  }

  return (
    <Select
      value={projectIdParam}
      onChange={handleChange}
    >
      <option value="ALL">All Projects</option>
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </Select>
  )
}






