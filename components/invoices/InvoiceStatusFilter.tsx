"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Select } from "@/components/ui/select"

export function InvoiceStatusFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const statusParam = searchParams.get("status") || "ALL"

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    const params = new URLSearchParams(searchParams.toString())
    
    if (value === "ALL") {
      params.delete("status")
    } else {
      params.set("status", value)
    }
    
    router.push(`/dashboard/bills?${params.toString()}`)
  }

  return (
    <Select
      value={statusParam}
      onChange={handleChange}
    >
      <option value="ALL">All Statuses</option>
      <option value="DRAFT">Draft</option>
      <option value="SUBMITTED">Submitted</option>
      <option value="APPROVED">Approved</option>
      <option value="PAID">Paid</option>
      <option value="CANCELLED">Cancelled</option>
      <option value="WRITTEN_OFF">Written Off</option>
      <option value="OUTSTANDING">Outstanding</option>
    </Select>
  )
}






