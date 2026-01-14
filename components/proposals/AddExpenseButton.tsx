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
  onExpenseAdded: (expense: Expense | DirectExpense) => void
}

interface DirectExpense {
  id: string // Temporary ID
  description: string
  amount: number
  currency: string
  expenseDate: string
  category: string | null
  isBillable: boolean
  isReimbursement: boolean
  isEstimated: boolean // New field for estimated expenses
  billedAt: null // Not billed yet
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

  const [showDirectForm, setShowDirectForm] = useState(false)
  const [directExpense, setDirectExpense] = useState<Partial<DirectExpense>>({
    description: "",
    amount: 0,
    currency: currency,
    expenseDate: new Date().toISOString().split("T")[0],
    category: null,
    isBillable: true,
    isReimbursement: false,
    isEstimated: false,
  })

  const handleAddDirectExpense = () => {
    if (!directExpense.description || !directExpense.amount) {
      return
    }
    const newExpense: DirectExpense = {
      id: `direct-${Date.now()}`,
      description: directExpense.description!,
      amount: directExpense.amount!,
      currency: currency,
      expenseDate: directExpense.expenseDate || new Date().toISOString().split("T")[0],
      category: directExpense.category || null,
      isBillable: directExpense.isBillable ?? true,
      isReimbursement: directExpense.isReimbursement ?? false,
      isEstimated: directExpense.isEstimated ?? false,
      billedAt: null,
    }
    onExpenseAdded(newExpense)
    setShowModal(false)
    setShowDirectForm(false)
    setSelectedProjectId("")
    setExpenses([])
    setDirectExpense({
      description: "",
      amount: 0,
      currency: currency,
      expenseDate: new Date().toISOString().split("T")[0],
      category: null,
      isBillable: true,
      isReimbursement: false,
      isEstimated: false,
    })
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
                <CardTitle>Add Expense</CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowModal(false)
                    setShowDirectForm(false)
                    setSelectedProjectId("")
                    setExpenses([])
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={!showDirectForm ? "default" : "outline"}
                  onClick={() => {
                    setShowDirectForm(false)
                    setSelectedProjectId("")
                    setExpenses([])
                  }}
                >
                  From Project
                </Button>
                <Button
                  type="button"
                  variant={showDirectForm ? "default" : "outline"}
                  onClick={() => {
                    setShowDirectForm(true)
                    setSelectedProjectId("")
                    setExpenses([])
                  }}
                >
                  Create Estimated Expense
                </Button>
              </div>

              {!showDirectForm ? (
                <>
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
                </>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description *</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded"
                      value={directExpense.description || ""}
                      onChange={(e) => setDirectExpense({ ...directExpense, description: e.target.value })}
                      placeholder="e.g., Travel expenses"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Amount ({currency}) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full px-3 py-2 border rounded"
                        value={directExpense.amount || ""}
                        onChange={(e) => setDirectExpense({ ...directExpense, amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Date *</label>
                      <input
                        type="date"
                        className="w-full px-3 py-2 border rounded"
                        value={directExpense.expenseDate || ""}
                        onChange={(e) => setDirectExpense({ ...directExpense, expenseDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category (Optional)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded"
                      value={directExpense.category || ""}
                      onChange={(e) => setDirectExpense({ ...directExpense, category: e.target.value || null })}
                      placeholder="e.g., Travel, Office Supplies"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isEstimated"
                        checked={directExpense.isEstimated || false}
                        onChange={(e) => setDirectExpense({ ...directExpense, isEstimated: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <label htmlFor="isEstimated" className="cursor-pointer text-sm font-medium">
                        Mark as Estimated
                      </label>
                    </div>
                    <p className="text-xs text-gray-500">Check this if the expense amount is an estimate rather than an actual cost</p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddDirectExpense}
                    disabled={!directExpense.description || !directExpense.amount}
                  >
                    Add Expense
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
