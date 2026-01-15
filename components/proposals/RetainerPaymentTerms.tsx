"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface RetainerPaymentTermsProps {
  currency: string
  retainerUnusedBalancePolicy: string | null
  retainerUnusedBalanceExpiryMonths: number | null
  onUnusedBalancePolicyChange: (policy: string | null) => void
  onUnusedBalanceExpiryMonthsChange: (months: number | null) => void
}

const CURRENCIES: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
}

export function RetainerPaymentTerms({
  currency,
  retainerUnusedBalancePolicy,
  retainerUnusedBalanceExpiryMonths,
  onUnusedBalancePolicyChange,
  onUnusedBalanceExpiryMonthsChange,
}: RetainerPaymentTermsProps) {
  const currencySymbol = CURRENCIES[currency] || currency

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retainer Payment Terms</CardTitle>
        <CardDescription>Configure how unused balance is handled</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Label className="text-base font-semibold">Unused Balance Policy</Label>
          <p className="text-sm text-gray-600">What happens to unused retainer hours?</p>
          <div className="space-y-3">
            <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="retainerUnusedBalancePolicy"
                value="EXPIRE"
                checked={retainerUnusedBalancePolicy === "EXPIRE"}
                onChange={(e) => {
                  onUnusedBalancePolicyChange(e.target.value)
                  // Set expiryMonths to null for "expires at end of month"
                  onUnusedBalanceExpiryMonthsChange(null)
                }}
                className="w-4 h-4"
              />
              <div className="flex-1">
                <div className="font-medium">Expires at the end of the month</div>
                <div className="text-sm text-gray-600">Unused hours expire within 30 days of the beginning of such rolling month</div>
              </div>
            </label>
            <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="retainerUnusedBalancePolicy"
                value="ROLLOVER"
                checked={retainerUnusedBalancePolicy === "ROLLOVER"}
                onChange={(e) => {
                  onUnusedBalancePolicyChange(e.target.value)
                  // Set default to 1 month when switching to ROLLOVER
                  if (e.target.value === "ROLLOVER" && retainerUnusedBalanceExpiryMonths === null) {
                    onUnusedBalanceExpiryMonthsChange(1)
                  }
                }}
                className="w-4 h-4"
              />
              <div className="flex-1">
                <div className="font-medium">Rolls over to __ months</div>
                <div className="text-sm text-gray-600">Unused hours carry forward for the specified number of months</div>
              </div>
            </label>
            {retainerUnusedBalancePolicy === "ROLLOVER" && (
              <div className="ml-7 space-y-2">
                <Label htmlFor="rolloverMonths">Number of months</Label>
                <Input
                  id="rolloverMonths"
                  type="number"
                  min="1"
                  value={retainerUnusedBalanceExpiryMonths || ""}
                  onChange={(e) => onUnusedBalanceExpiryMonthsChange(parseInt(e.target.value) || null)}
                  placeholder="Enter number of months"
                />
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> If approved, retainer hours will be available in drawdown mode and automatically offset against billed hours in timesheet or project mode for the specified client or project(s).
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
