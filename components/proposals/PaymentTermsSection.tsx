"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, Calendar } from "lucide-react"

interface PaymentTerm {
  upfrontType?: "PERCENT" | "FIXED_AMOUNT" | null
  upfrontValue?: number | null
  balancePaymentType?: "MILESTONE_BASED" | "TIME_BASED" | "FULL_UPFRONT" | null
  balanceDueDate?: string | null
  installmentType?: "TIME_BASED" | "MILESTONE_BASED" | null
  installmentCount?: number | null
  installmentFrequency?: "WEEKLY" | "MONTHLY" | "QUARTERLY" | null
  installmentMaturityDates?: string[] | null
  milestoneIds?: string[]
  recurringEnabled?: boolean
  recurringFrequency?: "MONTHLY_1" | "MONTHLY_3" | "MONTHLY_6" | "YEARLY_12" | "CUSTOM" | null
  recurringCustomMonths?: number | null
  recurringStartDate?: string | null
}

interface PaymentTermsSectionProps {
  currency: string
  milestones?: Array<{ id: string; name: string }>
  proposalLevel?: PaymentTerm | null
  itemLevel?: PaymentTerm[]
  onProposalLevelChange: (term: PaymentTerm | null) => void
  onItemLevelChange: (index: number, term: PaymentTerm | null) => void
  itemCount: number
}

const CURRENCIES: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
}

const RECURRING_FREQUENCIES = [
  { value: "MONTHLY_1", label: "1 Month" },
  { value: "MONTHLY_3", label: "3 Months" },
  { value: "MONTHLY_6", label: "6 Months" },
  { value: "YEARLY_12", label: "12 Months" },
  { value: "CUSTOM", label: "Custom" },
]

export function PaymentTermsSection({
  currency,
  milestones = [],
  proposalLevel,
  itemLevel = [],
  onProposalLevelChange,
  onItemLevelChange,
  itemCount,
}: PaymentTermsSectionProps) {
  const currencySymbol = CURRENCIES[currency] || currency
  const [showProposalLevel, setShowProposalLevel] = useState(!!proposalLevel)
  const [proposalTerm, setProposalTerm] = useState<PaymentTerm>(proposalLevel || {})

  useEffect(() => {
    if (proposalLevel) {
      setProposalTerm(proposalLevel)
      setShowProposalLevel(true)
    }
  }, [proposalLevel])

  const updateProposalTerm = (field: keyof PaymentTerm, value: any) => {
    const updated = { ...proposalTerm, [field]: value }
    setProposalTerm(updated)
    onProposalLevelChange(updated)
  }

  const hasUpfront = proposalTerm.upfrontType && proposalTerm.upfrontValue
  const hasFullUpfront = proposalTerm.upfrontType === "PERCENT" && proposalTerm.upfrontValue === 100
  const showBalancePayment = !hasFullUpfront && (hasUpfront || !proposalTerm.upfrontType)

  // Calculate installment maturity dates when installment count changes
  useEffect(() => {
    if (proposalTerm.installmentType === "TIME_BASED" && proposalTerm.installmentCount && proposalTerm.installmentFrequency && proposalTerm.recurringStartDate) {
      const startDate = new Date(proposalTerm.recurringStartDate)
      const dates: string[] = []
      const frequencyMonths = proposalTerm.installmentFrequency === "WEEKLY" ? 0.25 : 
                              proposalTerm.installmentFrequency === "MONTHLY" ? 1 : 3
      
      for (let i = 0; i < proposalTerm.installmentCount; i++) {
        const dueDate = new Date(startDate)
        dueDate.setMonth(dueDate.getMonth() + (i + 1) * frequencyMonths)
        dates.push(dueDate.toISOString().split("T")[0])
      }
      
      updateProposalTerm("installmentMaturityDates", dates)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalTerm.installmentType, proposalTerm.installmentCount, proposalTerm.installmentFrequency, proposalTerm.recurringStartDate])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Terms</CardTitle>
        <CardDescription>
          Configure payment terms for the entire proposal and optionally override per line item
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Proposal Level Payment Terms */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="proposalPaymentTerms"
              checked={showProposalLevel}
              onChange={(e) => {
                setShowProposalLevel(e.target.checked)
                if (!e.target.checked) {
                  onProposalLevelChange(null)
                  setProposalTerm({})
                } else {
                  onProposalLevelChange(proposalTerm)
                }
              }}
              className="rounded"
            />
            <Label htmlFor="proposalPaymentTerms" className="font-semibold">
              Set Default Payment Terms for Entire Proposal
            </Label>
          </div>

          {showProposalLevel && (
            <div className="p-4 border rounded space-y-6">
              {/* Section 1: Upfront Payment */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="hasUpfront"
                    checked={!!proposalTerm.upfrontType}
                    onChange={(e) => {
                      if (!e.target.checked) {
                        // Clear upfront payment fields in a single update
                        const updated = {
                          ...proposalTerm,
                          upfrontType: null,
                          upfrontValue: null,
                        }
                        setProposalTerm(updated)
                        onProposalLevelChange(updated)
                      } else {
                        // Set default upfront payment values
                        const updated = {
                          ...proposalTerm,
                          upfrontType: "PERCENT" as const,
                          upfrontValue: 0,
                        }
                        setProposalTerm(updated)
                        onProposalLevelChange(updated)
                      }
                    }}
                    className="rounded"
                  />
                  <Label htmlFor="hasUpfront" className="font-semibold">
                    Upfront Payment
                  </Label>
                </div>

                {proposalTerm.upfrontType && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                    <div className="space-y-2">
                      <Label className="text-sm">Type</Label>
                      <Select
                        value={proposalTerm.upfrontType || ""}
                        onChange={(e) => updateProposalTerm("upfrontType", e.target.value || null)}
                      >
                        <option value="PERCENT">Percentage</option>
                        <option value="FIXED_AMOUNT">Fixed Amount</option>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">
                        {proposalTerm.upfrontType === "PERCENT" ? "Percentage (%)" : `Amount (${currencySymbol})`}
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={proposalTerm.upfrontType === "PERCENT" ? "100" : undefined}
                        value={proposalTerm.upfrontValue || ""}
                        onChange={(e) => updateProposalTerm("upfrontValue", parseFloat(e.target.value) || null)}
                        placeholder={proposalTerm.upfrontType === "PERCENT" ? "0-100" : "0.00"}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Balance Payment */}
              {showBalancePayment && (
                <div className="space-y-4 pt-4 border-t">
                  <Label className="font-semibold">Balance Payment</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Payment Type</Label>
                      <Select
                        value={proposalTerm.balancePaymentType || ""}
                        onChange={(e) => updateProposalTerm("balancePaymentType", e.target.value || null)}
                      >
                        <option value="">Select type</option>
                        <option value="MILESTONE_BASED">Milestone-Based</option>
                        <option value="TIME_BASED">Time-Based Deadline</option>
                        <option value="FULL_UPFRONT">Full Upfront (if no upfront was set)</option>
                      </Select>
                    </div>
                    {proposalTerm.balancePaymentType === "TIME_BASED" && (
                      <div className="space-y-2">
                        <Label className="text-sm">Due Date</Label>
                        <Input
                          type="date"
                          value={proposalTerm.balanceDueDate || ""}
                          onChange={(e) => updateProposalTerm("balanceDueDate", e.target.value || null)}
                        />
                      </div>
                    )}
                    {proposalTerm.balancePaymentType === "MILESTONE_BASED" && milestones.length > 0 && (
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-sm">Select Milestones</Label>
                        <div className="space-y-2">
                          {milestones.map((milestone) => (
                            <label key={milestone.id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={proposalTerm.milestoneIds?.includes(milestone.id) || false}
                                onChange={(e) => {
                                  const currentIds = proposalTerm.milestoneIds || []
                                  const updatedIds = e.target.checked
                                    ? [...currentIds, milestone.id]
                                    : currentIds.filter(id => id !== milestone.id)
                                  updateProposalTerm("milestoneIds", updatedIds)
                                }}
                                className="rounded"
                              />
                              <span>{milestone.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Section 3: Installments */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="hasInstallments"
                    checked={!!proposalTerm.installmentType}
                    onChange={(e) => {
                      if (!e.target.checked) {
                        // Clear all installment fields in a single update
                        const updated = {
                          ...proposalTerm,
                          installmentType: null,
                          installmentCount: null,
                          installmentFrequency: null,
                          installmentMaturityDates: null,
                        }
                        setProposalTerm(updated)
                        onProposalLevelChange(updated)
                      } else {
                        // Set default installment values
                        const updated = {
                          ...proposalTerm,
                          installmentType: "TIME_BASED" as const,
                          installmentCount: 1,
                          installmentFrequency: "MONTHLY" as const,
                        }
                        setProposalTerm(updated)
                        onProposalLevelChange(updated)
                      }
                    }}
                    className="rounded"
                  />
                  <Label htmlFor="hasInstallments" className="font-semibold">
                    Installments
                  </Label>
                </div>

                {proposalTerm.installmentType && (
                  <div className="space-y-4 pl-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm">Installment Type</Label>
                        <Select
                          value={proposalTerm.installmentType || ""}
                          onChange={(e) => {
                            updateProposalTerm("installmentType", e.target.value || null)
                            if (e.target.value !== "TIME_BASED") {
                              updateProposalTerm("installmentFrequency", null)
                              updateProposalTerm("installmentMaturityDates", null)
                            }
                          }}
                        >
                          <option value="TIME_BASED">Time-Based</option>
                          <option value="MILESTONE_BASED">Milestone-Based</option>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Number of Installments</Label>
                        <Input
                          type="number"
                          min="1"
                          value={proposalTerm.installmentCount || ""}
                          onChange={(e) => {
                            const count = parseInt(e.target.value) || null
                            updateProposalTerm("installmentCount", count)
                            // Reset maturity dates when count changes
                            if (count && proposalTerm.installmentType === "TIME_BASED") {
                              updateProposalTerm("installmentMaturityDates", null)
                            }
                          }}
                          placeholder="e.g., 4"
                        />
                      </div>
                    </div>

                    {proposalTerm.installmentType === "TIME_BASED" && (
                      <>
                        <div className="space-y-2">
                          <Label className="text-sm">Frequency</Label>
                          <Select
                            value={proposalTerm.installmentFrequency || ""}
                            onChange={(e) => {
                              updateProposalTerm("installmentFrequency", e.target.value || null)
                              updateProposalTerm("installmentMaturityDates", null)
                            }}
                          >
                            <option value="">Select frequency</option>
                            <option value="WEEKLY">Weekly</option>
                            <option value="MONTHLY">Monthly</option>
                            <option value="QUARTERLY">Quarterly</option>
                          </Select>
                        </div>
                        {proposalTerm.installmentCount && proposalTerm.installmentFrequency && (
                          <div className="space-y-2">
                            <Label className="text-sm">Installment Maturity Dates</Label>
                            <div className="space-y-2">
                              {Array.from({ length: proposalTerm.installmentCount }).map((_, index) => {
                                const dates = proposalTerm.installmentMaturityDates || []
                                return (
                                  <div key={index} className="flex items-center space-x-2">
                                    <Label className="text-xs w-32">Installment {index + 1}:</Label>
                                    <Input
                                      type="date"
                                      value={dates[index] || ""}
                                      onChange={(e) => {
                                        const newDates = [...dates]
                                        newDates[index] = e.target.value
                                        updateProposalTerm("installmentMaturityDates", newDates)
                                      }}
                                      className="flex-1"
                                    />
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {proposalTerm.installmentType === "MILESTONE_BASED" && milestones.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm">Select Milestones for Installments</Label>
                        <div className="space-y-2">
                          {milestones.map((milestone) => (
                            <label key={milestone.id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={proposalTerm.milestoneIds?.includes(milestone.id) || false}
                                onChange={(e) => {
                                  const currentIds = proposalTerm.milestoneIds || []
                                  const updatedIds = e.target.checked
                                    ? [...currentIds, milestone.id]
                                    : currentIds.filter(id => id !== milestone.id)
                                  updateProposalTerm("milestoneIds", updatedIds)
                                }}
                                className="rounded"
                              />
                              <span>{milestone.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Note: Recurring Payment is now configured via billing method in line items */}
            </div>
          )}
        </div>

        {/* Item Level Payment Terms Override */}
        {itemCount > 0 && (
          <div className="space-y-4 pt-4 border-t">
            <Label className="font-semibold">Override Payment Terms per Line Item (Optional)</Label>
            <p className="text-xs text-gray-500">
              Leave empty to use proposal-level terms. Configure to override for specific items.
            </p>
            {/* This will be handled in the parent component for each item */}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
