"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatDate, formatCurrency } from "@/lib/utils"
import { ProjectChargeForm } from "./ProjectChargeForm"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
interface ProjectCharge {
  id: string
  description: string
  amount: number
  quantity: number
  unitPrice: number
  chargeType: "ONE_TIME" | "RECURRING"
  recurringFrequency: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" | null
  startDate: string | null
  endDate: string | null
  billed: boolean
  createdAt: string
}

interface ProposalItem {
  id: string
  description: string
  quantity: number | null
  unitPrice: number | null
  amount: number
  billingMethod?: string | null
}

interface ProjectChargesSectionProps {
  projectId: string
  initialCharges: ProjectCharge[]
  proposalItems?: ProposalItem[]
  currency?: string
}

export function ProjectChargesSection({ projectId, initialCharges, proposalItems = [], currency = "EUR" }: ProjectChargesSectionProps) {
  const [charges, setCharges] = useState<ProjectCharge[]>(initialCharges)
  const [showForm, setShowForm] = useState(false)
  const [editingCharge, setEditingCharge] = useState<ProjectCharge | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleRefresh = () => {
    setLoading(true)
    fetch(`/api/projects/${projectId}/charges`)
      .then((res) => res.json())
      .then((data) => {
        setCharges(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Failed to refresh charges:", err)
        setLoading(false)
      })
  }

  const handleDelete = async (chargeId: string) => {
    if (!confirm("Are you sure you want to delete this charge?")) {
      return
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/charges/${chargeId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete charge")
      }

      handleRefresh()
      router.refresh()
    } catch (err) {
      console.error("Failed to delete charge:", err)
      alert("Failed to delete charge. Please try again.")
    }
  }

  const totalAmount = charges.reduce((sum, charge) => sum + charge.amount, 0)
  const billedAmount = charges.filter(c => c.billed).reduce((sum, charge) => sum + charge.amount, 0)
  const unbilledAmount = charges.filter(c => !c.billed).reduce((sum, charge) => sum + charge.amount, 0)

  return (
    <>
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Fixed Charges</CardTitle>
            <Button onClick={() => { setEditingCharge(null); setShowForm(true) }} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Charge
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading...</p>
          ) : charges.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No charges yet</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Description</th>
                      <th className="text-right p-2">Amount</th>
                      <th className="text-center p-2">Type</th>
                      <th className="text-center p-2">Frequency</th>
                      <th className="text-left p-2">Start Date</th>
                      <th className="text-left p-2">End Date</th>
                      <th className="text-center p-2">Billed</th>
                      <th className="text-right p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map((charge) => (
                      <tr key={charge.id} className="border-b">
                        <td className="p-2">{charge.description}</td>
                        <td className="p-2 text-right">{formatCurrency(charge.amount)}</td>
                        <td className="p-2 text-center">
                          {charge.chargeType === "ONE_TIME" ? (
                            <span className="text-gray-600">One-Time</span>
                          ) : (
                            <span className="text-blue-600">Recurring</span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {charge.recurringFrequency ? (
                            <span className="text-sm">{charge.recurringFrequency.toLowerCase()}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="p-2">{charge.startDate ? formatDate(charge.startDate) : "-"}</td>
                        <td className="p-2">{charge.endDate ? formatDate(charge.endDate) : "-"}</td>
                        <td className="p-2 text-center">
                          {charge.billed ? (
                            <span className="text-blue-600">Yes</span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setEditingCharge(charge); setShowForm(true) }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(charge.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td className="p-2">Total</td>
                      <td className="p-2 text-right">{formatCurrency(totalAmount)}</td>
                      <td colSpan={5}></td>
                    </tr>
                    <tr className="border-t">
                      <td className="p-2 text-sm text-gray-600">Billed</td>
                      <td className="p-2 text-right text-sm text-gray-600">{formatCurrency(billedAmount)}</td>
                      <td colSpan={5}></td>
                    </tr>
                    <tr className="border-t">
                      <td className="p-2 text-sm text-gray-600">Unbilled</td>
                      <td className="p-2 text-right text-sm text-gray-600">{formatCurrency(unbilledAmount)}</td>
                      <td colSpan={5}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <ProjectChargeForm
          projectId={projectId}
          charge={editingCharge}
          isOpen={showForm}
          onClose={() => { setShowForm(false); setEditingCharge(null) }}
          onSuccess={() => { handleRefresh(); router.refresh() }}
          proposalItems={proposalItems}
          currency={currency}
        />
      )}
    </>
  )
}

