"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface RetainerPaymentTermsProps {
  currency: string
  retainerExcessBillingType: string | null
  retainerUnusedBalancePolicy: string | null
  retainerUnusedBalanceExpiryMonths: number | null
  onExcessBillingTypeChange: (type: string | null) => void
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
  retainerExcessBillingType,
  retainerUnusedBalancePolicy,
  retainerUnusedBalanceExpiryMonths,
  onExcessBillingTypeChange,
  onUnusedBalancePolicyChange,
  onUnusedBalanceExpiryMonthsChange,
}: RetainerPaymentTermsProps) {
  const currencySymbol = CURRENCIES[currency] || currency

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retainer Payment Terms</CardTitle>
        <CardDescription>Configure how excess hours are billed and unused balance is handled</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Label className="text-base font-semibold">Excess Hours Billing</Label>
          <p className="text-sm text-gray-600">How will hours beyond the retainer package be billed?</p>
          <div className="space-y-3">
            <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="retainerExcessBillingType"
                value="ADDITIONAL_HOURS_RATE"
                checked={retainerExcessBillingType === "ADDITIONAL_HOURS_RATE"}
                onChange={(e) => onExcessBillingTypeChange(e.target.value)}
                className="w-4 h-4"
              />
              <div className="flex-1">
                <div className="font-medium">At additional hours rate</div>
                <div className="text-sm text-gray-600">Use the rate configured for additional hours</div>
              </div>
            </label>
            <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="retainerExcessBillingType"
                value="STANDARD_HOURLY_RATES"
                checked={retainerExcessBillingType === "STANDARD_HOURLY_RATES"}
                onChange={(e) => onExcessBillingTypeChange(e.target.value)}
                className="w-4 h-4"
              />
              <div className="flex-1">
                <div className="font-medium">At standard hourly rates</div>
                <div className="text-sm text-gray-600">Use standard hourly rates for each professional</div>
              </div>
            </label>
            <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="retainerExcessBillingType"
                value="BLENDED_RATE"
                checked={retainerExcessBillingType === "BLENDED_RATE"}
                onChange={(e) => onExcessBillingTypeChange(e.target.value)}
                className="w-4 h-4"
              />
              <div className="flex-1">
                <div className="font-medium">At blended rate</div>
                <div className="text-sm text-gray-600">Use a single blended rate for all excess hours</div>
              </div>
            </label>
          </div>
        </div>

        <div className="pt-4 border-t space-y-4">
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
                  if (e.target.value === "EXPIRE" && !retainerUnusedBalanceExpiryMonths) {
                    onUnusedBalanceExpiryMonthsChange(1)
                  }
                }}
                className="w-4 h-4"
              />
              <div className="flex-1">
                <div className="font-medium">Expires after X months</div>
                <div className="text-sm text-gray-600">Unused hours expire after a specified period</div>
              </div>
            </label>
            {retainerUnusedBalancePolicy === "EXPIRE" && (
              <div className="ml-7 space-y-2">
                <Label htmlFor="expiryMonths">Months before expiry</Label>
                <Input
                  id="expiryMonths"
                  type="number"
                  min="1"
                  value={retainerUnusedBalanceExpiryMonths || ""}
                  onChange={(e) => onUnusedBalanceExpiryMonthsChange(parseInt(e.target.value) || null)}
                  placeholder="Enter number of months"
                />
              </div>
            )}
            <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="retainerUnusedBalancePolicy"
                value="ROLLOVER"
                checked={retainerUnusedBalancePolicy === "ROLLOVER"}
                onChange={(e) => {
                  onUnusedBalancePolicyChange(e.target.value)
                  onUnusedBalanceExpiryMonthsChange(null)
                }}
                className="w-4 h-4"
              />
              <div className="flex-1">
                <div className="font-medium">Rolls over to next month</div>
                <div className="text-sm text-gray-600">Unused hours carry forward to the next billing period</div>
              </div>
            </label>
            {retainerUnusedBalancePolicy === "ROLLOVER" && (
              <div className="ml-7 space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={retainerUnusedBalanceExpiryMonths !== null}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onUnusedBalanceExpiryMonthsChange(3) // Default to 3 months
                      } else {
                        onUnusedBalanceExpiryMonthsChange(null)
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">Expires after X months of non-use</span>
                </label>
                {retainerUnusedBalanceExpiryMonths !== null && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="rolloverExpiryMonths">Months of non-use before expiry</Label>
                    <Input
                      id="rolloverExpiryMonths"
                      type="number"
                      min="1"
                      value={retainerUnusedBalanceExpiryMonths || ""}
                      onChange={(e) => onUnusedBalanceExpiryMonthsChange(parseInt(e.target.value) || null)}
                      placeholder="Enter number of months"
                    />
                  </div>
                )}
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
