"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { ExpenseForm } from "@/components/projects/ExpenseForm"

export default function EditExpensePage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const expenseId = params.expenseId as string
  const [expense, setExpense] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchExpense()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, expenseId])

  const fetchExpense = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/expenses`)
      if (response.ok) {
        const data = await response.json()
        const foundExpense = data.expenses.find((e: any) => e.id === expenseId)
        if (foundExpense) {
          setExpense(foundExpense)
        }
      }
    } catch (error) {
      console.error("Error fetching expense:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSuccess = () => {
    router.push(`/dashboard/projects/${projectId}`)
  }

  const handleCancel = () => {
    router.push(`/dashboard/projects/${projectId}`)
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (!expense) {
    return <div>Expense not found</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Edit Expense</h1>
        <button
          onClick={handleCancel}
          className="text-gray-600 hover:text-gray-900"
        >
          Cancel
        </button>
      </div>

      <ExpenseForm
        projectId={projectId}
        initialData={expense}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  )
}
