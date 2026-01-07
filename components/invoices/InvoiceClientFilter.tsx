"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Select } from "@/components/ui/select"

interface InvoiceClientFilterProps {
  clients: Array<{ id: string; name: string; company?: string | null }>
}

export function InvoiceClientFilter({ clients }: InvoiceClientFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clientIdParam = searchParams.get("clientId") || "ALL"

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    const params = new URLSearchParams(searchParams.toString())
    
    if (value === "ALL") {
      params.delete("clientId")
    } else {
      params.set("clientId", value)
    }
    
    router.push(`/dashboard/bills?${params.toString()}`)
  }

  return (
    <Select
      value={clientIdParam}
      onChange={handleChange}
    >
      <option value="ALL">All Clients</option>
      {clients.map((client) => (
        <option key={client.id} value={client.id}>
          {client.name} {client.company ? `(${client.company})` : ""}
        </option>
      ))}
    </Select>
  )
}





