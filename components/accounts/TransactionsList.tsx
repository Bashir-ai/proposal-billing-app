"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency, formatDate } from "@/lib/utils"
import { ArrowUpCircle, ArrowDownCircle, DollarSign, Plus } from "lucide-react"

interface Transaction {
  id: string
  type: "COMPENSATION" | "ADVANCE" | "PAYMENT" | "ADJUSTMENT"
  amount: number
  currency: string
  transactionDate: string
  description: string
  notes: string | null
  createdAt: string
  creator: {
    id: string
    name: string
    email: string
  }
}

interface TransactionsListProps {
  userId: string
  startDate: string | null
  endDate: string | null
  isAdmin?: boolean
  isManager?: boolean
}

export function TransactionsList({ userId, startDate, endDate, isAdmin = false, isManager = false }: TransactionsListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState<string>("")
  const [sortBy, setSortBy] = useState<"date" | "amount">("date")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    type: "ADJUSTMENT" as "COMPENSATION" | "ADVANCE" | "PAYMENT" | "ADJUSTMENT",
    amount: "",
    currency: "EUR",
    transactionDate: new Date().toISOString().split("T")[0],
    description: "",
    notes: "",
  })

  useEffect(() => {
    fetchTransactions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, startDate, endDate, selectedType])

  const fetchTransactions = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (startDate) params.set("startDate", startDate)
      if (endDate) params.set("endDate", endDate)
      if (selectedType) params.set("type", selectedType)
      params.set("limit", "100")

      const response = await fetch(`/api/users/${userId}/accounts/transactions?${params.toString()}`)
      const data = await response.json()
      
      let sortedTransactions = data.transactions || []
      if (sortBy === "date") {
        sortedTransactions.sort((a: Transaction, b: Transaction) => 
          new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
        )
      } else if (sortBy === "amount") {
        sortedTransactions.sort((a: Transaction, b: Transaction) => 
          Math.abs(b.amount) - Math.abs(a.amount)
        )
      }
      
      setTransactions(sortedTransactions)
    } catch (error) {
      console.error("Error fetching transactions:", error)
    } finally {
      setLoading(false)
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "COMPENSATION": return "Compensation"
      case "ADVANCE": return "Advance"
      case "PAYMENT": return "Payment"
      case "ADJUSTMENT": return "Adjustment"
      default: return type
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "COMPENSATION": return "bg-green-100 text-green-800"
      case "ADVANCE": return "bg-red-100 text-red-800"
      case "PAYMENT": return "bg-blue-100 text-blue-800"
      case "ADJUSTMENT": return "bg-yellow-100 text-yellow-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const handleCreate = () => {
    setFormData({
      type: "ADJUSTMENT",
      amount: "",
      currency: "EUR",
      transactionDate: new Date().toISOString().split("T")[0],
      description: "",
      notes: "",
    })
    setShowCreateModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch(`/api/users/${userId}/accounts/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          notes: formData.notes || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || "Failed to create transaction")
        return
      }

      setShowCreateModal(false)
      await fetchTransactions()
    } catch (error) {
      console.error("Error creating transaction:", error)
      alert("Failed to create transaction")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div>Loading transactions...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Financial Transactions</h3>
          <p className="text-sm text-gray-600">Unified transaction log</p>
        </div>
        {(isAdmin || isManager) && (
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Transaction
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div>
          <label className="text-sm font-medium mr-2">Filter by Type:</label>
          <Select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="min-w-[150px]"
          >
            <option value="">All Types</option>
            <option value="COMPENSATION">Compensation</option>
            <option value="ADVANCE">Advance</option>
            <option value="PAYMENT">Payment</option>
            <option value="ADJUSTMENT">Adjustment</option>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium mr-2">Sort by:</label>
          <Select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as "date" | "amount")
              fetchTransactions()
            }}
            className="min-w-[120px]"
          >
            <option value="date">Date</option>
            <option value="amount">Amount</option>
          </Select>
        </div>
      </div>

      {transactions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-gray-500">No transactions found for the selected period.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {transactions.map((transaction) => (
            <Card key={transaction.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      {transaction.amount >= 0 ? (
                        <ArrowUpCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <ArrowDownCircle className="h-5 w-5 text-red-600" />
                      )}
                      <h4 className="font-semibold">{transaction.description}</h4>
                      <span className={`px-2 py-1 rounded text-xs ${getTypeColor(transaction.type)}`}>
                        {getTypeLabel(transaction.type)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Amount:</span>
                        <div className={`font-semibold ${transaction.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {transaction.amount >= 0 ? "+" : ""}{formatCurrency(transaction.amount)}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">Date:</span>
                        <div className="font-semibold">{formatDate(transaction.transactionDate)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Created By:</span>
                        <div className="font-semibold">{transaction.creator.name}</div>
                      </div>
                      {transaction.notes && (
                        <div>
                          <span className="text-gray-600">Notes:</span>
                          <div className="font-semibold">{transaction.notes}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Transaction Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl m-4">
            <CardHeader>
              <CardTitle>Create Transaction</CardTitle>
              <CardDescription>Manually create a financial transaction (use negative amounts for debts)</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Type *</Label>
                  <Select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as Transaction["type"] })}
                  >
                    <option value="ADJUSTMENT">Adjustment</option>
                    <option value="PAYMENT">Payment</option>
                    <option value="ADVANCE">Advance</option>
                    <option value="COMPENSATION">Compensation</option>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                      placeholder="Use negative for debts"
                    />
                    <p className="text-xs text-gray-500">Use negative amounts for debts/things owed</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    >
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Transaction Date *</Label>
                  <Input
                    type="date"
                    value={formData.transactionDate}
                    onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description *</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    placeholder="e.g., Office equipment purchase"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder="Additional notes about this transaction"
                  />
                </div>

                <div className="flex justify-end gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Creating..." : "Create Transaction"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
