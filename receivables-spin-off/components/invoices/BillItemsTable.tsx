"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatDate } from "@/lib/utils"
import { EditableBillItem } from "./EditableBillItem"
import { AddBillItemButton } from "./AddBillItemButton"

interface BillItem {
  id: string
  type: string
  description: string
  quantity: number | null
  rate: number | null
  unitPrice: number | null
  discountPercent: number | null
  discountAmount: number | null
  amount: number
  billedHours: number | null
  isManuallyEdited: boolean
  isCredit: boolean
  personId: string | null
  date: Date | null
  timesheetEntryId: string | null
  person?: {
    id: string
    name: string
    email: string
  } | null
}

interface BillItemsTableProps {
  items: BillItem[]
  billId: string
  currency: string
  canEdit: boolean
  users: Array<{ id: string; name: string; email: string }>
  subtotal: number
}

export function BillItemsTable({
  items,
  billId,
  currency,
  canEdit,
  users,
  subtotal,
}: BillItemsTableProps) {
  const router = useRouter()
  const [refreshKey, setRefreshKey] = useState(0)

  const handleUpdate = () => {
    router.refresh()
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Invoice Line Items</CardTitle>
          {canEdit && (
            <AddBillItemButton billId={billId} currency={currency} users={users} />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {items && items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Person</th>
                  <th className="text-left p-2">Description</th>
                  <th className="text-right p-2">Quantity</th>
                  <th className="text-right p-2">Rate/Price</th>
                  <th className="text-right p-2">Amount</th>
                  {canEdit && <th className="p-2"></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <EditableBillItem
                    key={item.id}
                    item={item}
                    billId={billId}
                    currency={currency}
                    canEdit={canEdit}
                    users={users}
                    onUpdate={handleUpdate}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td colSpan={canEdit ? 7 : 6} className="p-2 text-right">Subtotal:</td>
                  <td className="p-2 text-right">
                    {formatCurrency(subtotal, currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No line items yet.</p>
            {canEdit && (
              <p className="text-sm mt-2">Click &quot;Add Line Item&quot; to create one.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
