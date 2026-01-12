"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { formatCurrency, formatDate } from "@/lib/utils"
import { ArrowUpCircle, ArrowDownCircle, DollarSign } from "lucide-react"

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
}

export function TransactionsList({ userId, startDate, endDate }: TransactionsListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState<string>("")
  const [sortBy, setSortBy] = useState<"date" | "amount">("date")

  useEffect(() => {
    fetchTransactions()
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
    </div>
  )
}
