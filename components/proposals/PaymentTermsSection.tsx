"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"

interface PaymentTerm {
  upfrontType?: "PERCENT" | "FIXED_AMOUNT"
  upfrontValue?: number
  installmentType?: "TIME_BASED" | "MILESTONE_BASED"
  installmentCount?: number
  installmentFrequency?: "WEEKLY" | "MONTHLY" | "QUARTERLY"
  milestoneIds?: string[]
}

interface PaymentTermsSectionProps {
  currency: string
  milestones?: Array<{ id: string; name: string }>
  proposalLevel?: PaymentTerm
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

  const updateProposalTerm = (field: keyof PaymentTerm, value: any) => {
    const updated = { ...proposalTerm, [field]: value }
    setProposalTerm(updated)
    onProposalLevelChange(updated)
  }

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
                }
              }}
              className="rounded"
            />
            <Label htmlFor="proposalPaymentTerms" className="font-semibold">
              Set Default Payment Terms for Entire Proposal
            </Label>
          </div>

          {showProposalLevel && (
            <div className="p-4 border rounded space-y-4">
              {/* Upfront Payment */}
              <div className="space-y-2">
                <Label>Upfront Payment</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Type</Label>
                    <Select
                      value={proposalTerm.upfrontType || ""}
                      onChange={(e) => updateProposalTerm("upfrontType", e.target.value || undefined)}
                    >
                      <option value="">No upfront payment</option>
                      <option value="PERCENT">Percentage</option>
                      <option value="FIXED_AMOUNT">Fixed Amount</option>
                    </Select>
                  </div>
                  {proposalTerm.upfrontType && (
                    <div className="space-y-2">
                      <Label className="text-sm">
                        {proposalTerm.upfrontType === "PERCENT" ? "Percentage (%)" : `Amount (${currencySymbol})`}
                      </Label>
                      <Input
                        type="number"
                        step={proposalTerm.upfrontType === "PERCENT" ? "0.01" : "0.01"}
                        min="0"
                        max={proposalTerm.upfrontType === "PERCENT" ? "100" : undefined}
                        value={proposalTerm.upfrontValue || ""}
                        onChange={(e) => updateProposalTerm("upfrontValue", parseFloat(e.target.value) || undefined)}
                        placeholder={proposalTerm.upfrontType === "PERCENT" ? "0-100" : "0.00"}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Installments */}
              <div className="space-y-2">
                <Label>Remaining Payment Schedule</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Installment Type</Label>
                    <Select
                      value={proposalTerm.installmentType || ""}
                      onChange={(e) => updateProposalTerm("installmentType", e.target.value || undefined)}
                    >
                      <option value="">No installments</option>
                      <option value="TIME_BASED">Time-Based</option>
                      <option value="MILESTONE_BASED">Milestone-Based</option>
                    </Select>
                  </div>

                  {proposalTerm.installmentType === "TIME_BASED" && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-sm">Frequency</Label>
                        <Select
                          value={proposalTerm.installmentFrequency || ""}
                          onChange={(e) => updateProposalTerm("installmentFrequency", e.target.value || undefined)}
                        >
                          <option value="">Select frequency</option>
                          <option value="WEEKLY">Weekly</option>
                          <option value="MONTHLY">Monthly</option>
                          <option value="QUARTERLY">Quarterly</option>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Number of Installments</Label>
                        <Input
                          type="number"
                          min="1"
                          value={proposalTerm.installmentCount || ""}
                          onChange={(e) => updateProposalTerm("installmentCount", parseInt(e.target.value) || undefined)}
                          placeholder="e.g., 4"
                        />
                      </div>
                    </>
                  )}

                  {proposalTerm.installmentType === "MILESTONE_BASED" && milestones.length > 0 && (
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


