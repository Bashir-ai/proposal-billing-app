"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"

interface KycAlertProps {
  kycCompleted: boolean
}

export function KycAlert({ kycCompleted }: KycAlertProps) {
  if (kycCompleted) {
    return null
  }

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>KYC Not Completed</AlertTitle>
      <AlertDescription>
        This client has not completed their KYC (Know Your Customer) verification. Please ensure KYC is completed before proceeding with business activities.
      </AlertDescription>
    </Alert>
  )
}





