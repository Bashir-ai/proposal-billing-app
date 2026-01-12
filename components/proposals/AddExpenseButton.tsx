"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { Plus, X } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface Expense {
  id: string
  description: string
  amount: number
  currency: string
  expenseDate: string
  category: string | null
  isBillable: boolean
  isReimbursement: boolean
  billedAt: string | null
}

interface AddExpenseButtonProps {
  clientId: string
  currency: string
  onExpenseAdded: (expense: Expense) => void
}

export function AddExpenseButton({ clientId, currency, onExpenseAdded }: AddExpenseButtonProps) {
  const [showModal, setShowModal] = useState(false)
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(false)

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/projects?clientId=${clientId}`)
      if (response.ok) {
        const data = await response.json()
        setProjects(data.filter((p: any) => p.status === "ACTIVE" || p.status === "COMPLETED"))
      }
    } catch (error) {
      console.error("Error fetching projects:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchExpenses = async (projectId: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${projectId}/expenses`)
      if (response.ok) {
        const data = await response.json()
        // Filter to only show billable, unbilled expenses
        const availableExpenses = data.expenses.filter((e: Expense) => 
          e.isBillable && !e.billedAt && e.currency === currency
        )
        setExpenses(availableExpenses)
      }
    } catch (error) {
      console.error("Error fetching expenses:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = () => {
    setShowModal(true)
    fetchProjects()
  }

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId)
    if (projectId) {
      fetchExpenses(projectId)
    } else {
      setExpenses([])
    }
  }

  const handleAddExpense = (expense: Expense) => {
    onExpenseAdded(expense)
    setShowModal(false)
    setSelectedProjectId("")
    setExpenses([])
  }

  return (
    <>
      <Button type="button" onClick={handleOpen} size="sm" variant="outline">
        <Plus className="h-4 w-4 mr-2" />
        Add Expense
      </Button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl m-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Add Expense from Project</CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowModal(false)
                    setSelectedProjectId("")
                    setExpenses([])
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Project</label>
                <Select
                  value={selectedProjectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Select a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </div>

              {selectedProjectId && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Available Expenses (Billable & Unbilled)</label>
                  {loading ? (
                    <p className="text-sm text-gray-500">Loading expenses...</p>
                  ) : expenses.length === 0 ? (
                    <p className="text-sm text-gray-500">No billable, unbilled expenses found for this project.</p>
                  ) : (
                    <div className="space-y-2">
                      {expenses.map((expense) => (
                        <div
                          key={expense.id}
                          className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
                        >
                          <div className="flex-1">
                            <div className="font-medium">{expense.description}</div>
                            <div className="text-sm text-gray-600">
                              {expense.category && <span>{expense.category} • </span>}
                              {formatCurrency(expense.amount)} • {new Date(expense.expenseDate).toLocaleDateString()}
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleAddExpense(expense)}
                          >
                            Add
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
