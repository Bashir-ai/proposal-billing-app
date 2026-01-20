"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { ExpenseForm } from "@/components/projects/ExpenseForm"

export default function NewExpensePage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const handleSuccess = () => {
    router.push(`/dashboard/projects/${projectId}`)
  }

  const handleCancel = () => {
    router.push(`/dashboard/projects/${projectId}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Add Expense</h1>
        <button
          onClick={handleCancel}
          className="text-gray-600 hover:text-gray-900"
        >
          Cancel
        </button>
      </div>

      <ExpenseForm
        projectId={projectId}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  )
}
