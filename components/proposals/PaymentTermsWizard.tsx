"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Check } from "lucide-react"

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
  recurringEnabled?: boolean | null
  recurringFrequency?: "MONTHLY_1" | "MONTHLY_3" | "MONTHLY_6" | "YEARLY_12" | "CUSTOM" | null
  recurringCustomMonths?: number | null
  recurringStartDate?: string | null
}

interface PaymentTermsWizardProps {
  currency: string
  milestones?: Array<{ id: string; name: string }>
  proposalLevel?: PaymentTerm | null
  onProposalLevelChange: (term: PaymentTerm | null) => void
}

const CURRENCIES: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
}

const RECURRING_FREQUENCIES = [
  { value: "MONTHLY_1", label: "Monthly (1 month)" },
  { value: "MONTHLY_3", label: "Quarterly (3 months)" },
  { value: "MONTHLY_6", label: "Semi-annual (6 months)" },
  { value: "YEARLY_12", label: "Yearly (12 months)" },
  { value: "CUSTOM", label: "Custom" },
]

type PaymentStructure = "ONE_TIME" | "UPFRONT_BALANCE" | "RECURRING" | "INSTALLMENTS" | null

export function PaymentTermsWizard({
  currency,
  milestones = [],
  proposalLevel,
  onProposalLevelChange,
}: PaymentTermsWizardProps) {
  const currencySymbol = CURRENCIES[currency] || currency

  // Calculate default start date: first day of next month (or current month if before the 15th)
  const getDefaultStartDate = () => {
    const now = new Date()
    const day = now.getDate()
    if (day < 15) {
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    } else {
      return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0]
    }
  }

  // Detect payment structure from existing proposalLevel
  const detectPaymentStructure = (term: PaymentTerm | null | undefined): PaymentStructure => {
    if (!term) return null
    if (term.recurringEnabled && term.recurringFrequency) return "RECURRING"
    if (term.installmentType && term.installmentCount) return "INSTALLMENTS"
    if (term.upfrontType && term.upfrontValue !== null) return "UPFRONT_BALANCE"
    return "ONE_TIME"
  }

  const [currentStep, setCurrentStep] = useState(1)
  const [paymentStructure, setPaymentStructure] = useState<PaymentStructure>(() => detectPaymentStructure(proposalLevel ?? null))
  const [wizardData, setWizardData] = useState<PaymentTerm>(proposalLevel || {})
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Pre-populate wizard data if editing existing proposal
  useEffect(() => {
    if (proposalLevel) {
      setWizardData(proposalLevel)
      const structure = detectPaymentStructure(proposalLevel)
      setPaymentStructure(structure)
      // If structure is detected, skip to step 2 (configuration)
      if (structure) {
        setCurrentStep(2)
      }
    }
  }, [proposalLevel])

  const updateWizardData = (field: keyof PaymentTerm, value: any) => {
    setWizardData(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: "" }))
  }

  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (currentStep === 1) {
      if (!paymentStructure) {
        newErrors.paymentStructure = "Please select a payment structure"
        setErrors(newErrors)
        return false
      }
    } else if (currentStep === 2) {
      if (paymentStructure === "UPFRONT_BALANCE") {
        if (!wizardData.upfrontType) {
          newErrors.upfrontType = "Please select upfront payment type"
        }
        if (wizardData.upfrontValue === null || wizardData.upfrontValue === undefined) {
          newErrors.upfrontValue = "Please enter upfront payment amount"
        }
        if (wizardData.upfrontValue !== null && wizardData.upfrontValue !== undefined && wizardData.upfrontValue < 0) {
          newErrors.upfrontValue = "Upfront payment must be positive"
        }
        if (wizardData.upfrontType === "PERCENT" && wizardData.upfrontValue !== null && wizardData.upfrontValue !== undefined && wizardData.upfrontValue > 100) {
          newErrors.upfrontValue = "Percentage cannot exceed 100%"
        }
      } else if (paymentStructure === "RECURRING") {
        if (!wizardData.recurringFrequency) {
          newErrors.recurringFrequency = "Please select recurring frequency"
        }
        if (wizardData.recurringFrequency === "CUSTOM" && (!wizardData.recurringCustomMonths || wizardData.recurringCustomMonths < 1)) {
          newErrors.recurringCustomMonths = "Please enter a valid number of months"
        }
        if (!wizardData.recurringStartDate) {
          newErrors.recurringStartDate = "Please select a start date"
        }
      } else if (paymentStructure === "INSTALLMENTS") {
        if (!wizardData.installmentType) {
          newErrors.installmentType = "Please select installment type"
        }
        if (wizardData.installmentType === "TIME_BASED") {
          if (!wizardData.installmentCount || wizardData.installmentCount < 1) {
            newErrors.installmentCount = "Please enter number of installments"
          }
          if (!wizardData.installmentFrequency) {
            newErrors.installmentFrequency = "Please select installment frequency"
          }
        } else if (wizardData.installmentType === "MILESTONE_BASED") {
          if (!wizardData.milestoneIds || wizardData.milestoneIds.length === 0) {
            newErrors.milestoneIds = "Please select at least one milestone"
          }
        }
      }
      // For ONE_TIME, no additional validation needed
    } else if (currentStep === 3 && paymentStructure === "UPFRONT_BALANCE") {
      // Step 3 for UPFRONT_BALANCE: balance payment method
      if (!wizardData.balancePaymentType) {
        newErrors.balancePaymentType = "Please select how the balance will be paid"
      }
      if (wizardData.balancePaymentType === "TIME_BASED" && !wizardData.balanceDueDate) {
        newErrors.balanceDueDate = "Please select a due date"
      }
      // Only require milestone selection if milestones are available
      // If no milestones exist yet, user will create them in the milestones step
      if (wizardData.balancePaymentType === "MILESTONE_BASED" && milestones.length > 0 && (!wizardData.milestoneIds || wizardData.milestoneIds.length === 0)) {
        newErrors.milestoneIds = "Please select at least one milestone"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (!validateStep()) return

    if (currentStep === 1) {
      // Initialize wizard data based on structure
      if (paymentStructure === "RECURRING") {
        setWizardData({
          recurringEnabled: true,
          recurringFrequency: "MONTHLY_1" as const,
          recurringStartDate: getDefaultStartDate(),
          upfrontType: null,
          upfrontValue: null,
          balancePaymentType: null,
          installmentType: null,
        })
      } else if (paymentStructure === "ONE_TIME") {
        // For one-time, the wizard is already completed by useEffect
        // Just confirm completion
        return
      } else if (paymentStructure === "INSTALLMENTS") {
        setWizardData({
          installmentType: null,
          upfrontType: null,
          upfrontValue: null,
          balancePaymentType: null,
          recurringEnabled: null,
          recurringFrequency: null,
        })
      } else if (paymentStructure === "UPFRONT_BALANCE") {
        setWizardData({
          upfrontType: "PERCENT" as const,
          upfrontValue: 0,
          balancePaymentType: null,
          installmentType: null,
          recurringEnabled: null,
          recurringFrequency: null,
        })
      }
      setCurrentStep(2)
    } else if (currentStep === 2) {
      if (paymentStructure === "UPFRONT_BALANCE") {
        // Need step 3 for balance payment method
        setCurrentStep(3)
      } else {
        // Complete wizard for other structures
        onProposalLevelChange(wizardData)
      }
    } else if (currentStep === 3) {
      // Final step for UPFRONT_BALANCE
      onProposalLevelChange(wizardData)
    }
  }

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1)
    } else if (currentStep === 3) {
      setCurrentStep(2)
    }
  }

  const handleStructureSelect = (structure: PaymentStructure) => {
    setPaymentStructure(structure)
    setErrors(prev => ({ ...prev, paymentStructure: "" }))
  }

  const getTotalSteps = (): number => {
    if (paymentStructure === "UPFRONT_BALANCE") return 3
    if (paymentStructure === "ONE_TIME") return 2 // Step 1 + confirmation
    return 2 // Step 1 + configuration
  }

  const isCompleted = (): boolean => {
    if (!paymentStructure) return false
    if (paymentStructure === "ONE_TIME") return true
    if (paymentStructure === "RECURRING") {
      return !!(wizardData.recurringFrequency && wizardData.recurringStartDate)
    }
    if (paymentStructure === "INSTALLMENTS") {
      if (wizardData.installmentType === "TIME_BASED") {
        return !!(wizardData.installmentCount && wizardData.installmentFrequency)
      }
      if (wizardData.installmentType === "MILESTONE_BASED") {
        return !!(wizardData.milestoneIds && wizardData.milestoneIds.length > 0)
      }
      return false
    }
    if (paymentStructure === "UPFRONT_BALANCE") {
      // For milestone-based balance payment, only require milestone selection if milestones exist
      // If no milestones exist yet, user will create them in the milestones step
      const milestoneRequirement = wizardData.balancePaymentType === "MILESTONE_BASED" 
        ? (milestones.length === 0 || (wizardData.milestoneIds && wizardData.milestoneIds.length > 0))
        : true
      
      return !!(
        wizardData.upfrontType &&
        wizardData.upfrontValue !== null &&
        wizardData.balancePaymentType &&
        (wizardData.balancePaymentType !== "TIME_BASED" || wizardData.balanceDueDate) &&
        milestoneRequirement
      )
    }
    return false
  }

  // Handle one-time payment completion immediately when selected
  useEffect(() => {
    if (paymentStructure === "ONE_TIME" && currentStep === 1) {
      const oneTimeData: PaymentTerm = {
        upfrontType: null,
        upfrontValue: null,
        balancePaymentType: null,
        installmentType: null,
        recurringEnabled: null,
        recurringFrequency: null,
      }
      setWizardData(oneTimeData)
      // Complete wizard immediately for one-time payment
      onProposalLevelChange(oneTimeData)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentStructure, currentStep])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Terms (Required)</CardTitle>
        <CardDescription>
          Configure how payments will be structured for this proposal
        </CardDescription>
        <div className="flex items-center gap-2 mt-4">
          {[1, 2, 3].slice(0, getTotalSteps()).map((step) => (
            <div
              key={step}
              className={`flex-1 h-2 rounded-full ${
                step <= currentStep ? "bg-blue-600" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Step {currentStep} of {getTotalSteps()}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Select Payment Structure */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">
              How would you like to structure payments?
            </Label>
            <div className="space-y-3">
              <label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="paymentStructure"
                  value="ONE_TIME"
                  checked={paymentStructure === "ONE_TIME"}
                  onChange={() => handleStructureSelect("ONE_TIME")}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <div className="font-medium">One-time Payment</div>
                  <div className="text-sm text-gray-600">Balance due upon completion</div>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="paymentStructure"
                  value="UPFRONT_BALANCE"
                  checked={paymentStructure === "UPFRONT_BALANCE"}
                  onChange={() => handleStructureSelect("UPFRONT_BALANCE")}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <div className="font-medium">Upfront Payment + Balance</div>
                  <div className="text-sm text-gray-600">Pay part upfront, remainder later</div>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="paymentStructure"
                  value="RECURRING"
                  checked={paymentStructure === "RECURRING"}
                  onChange={() => handleStructureSelect("RECURRING")}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <div className="font-medium">Recurring Payments</div>
                  <div className="text-sm text-gray-600">Regular payments (monthly, quarterly, etc.)</div>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="paymentStructure"
                  value="INSTALLMENTS"
                  checked={paymentStructure === "INSTALLMENTS"}
                  onChange={() => handleStructureSelect("INSTALLMENTS")}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <div className="font-medium">Installments</div>
                  <div className="text-sm text-gray-600">Split into multiple payments over time or by milestones</div>
                </div>
              </label>
            </div>
            {errors.paymentStructure && (
              <p className="text-sm text-red-600">{errors.paymentStructure}</p>
            )}
          </div>
        )}

        {/* Step 2: Configure based on structure */}
        {currentStep === 2 && paymentStructure === "UPFRONT_BALANCE" && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">Upfront Payment Details</Label>
            
            <div className="space-y-2">
              <Label>Upfront Payment Type</Label>
              <Select
                value={wizardData.upfrontType || ""}
                onChange={(e) => updateWizardData("upfrontType", e.target.value || null)}
              >
                <option value="">Select type</option>
                <option value="PERCENT">Percentage</option>
                <option value="FIXED_AMOUNT">Fixed Amount</option>
              </Select>
              {errors.upfrontType && (
                <p className="text-sm text-red-600">{errors.upfrontType}</p>
              )}
            </div>

            {wizardData.upfrontType && (
              <div className="space-y-2">
                <Label>
                  Upfront Amount {wizardData.upfrontType === "PERCENT" ? "(%)" : `(${currencySymbol})`}
                </Label>
                <Input
                  type="number"
                  min="0"
                  max={wizardData.upfrontType === "PERCENT" ? "100" : undefined}
                  step={wizardData.upfrontType === "PERCENT" ? "1" : "0.01"}
                  value={wizardData.upfrontValue || ""}
                  onChange={(e) => updateWizardData("upfrontValue", parseFloat(e.target.value) || null)}
                  placeholder={wizardData.upfrontType === "PERCENT" ? "e.g., 50" : "e.g., 5000"}
                />
                {errors.upfrontValue && (
                  <p className="text-sm text-red-600">{errors.upfrontValue}</p>
                )}
              </div>
            )}
          </div>
        )}

        {currentStep === 2 && paymentStructure === "RECURRING" && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">Recurring Payment Details</Label>
            
            <div className="space-y-2">
              <Label>Payment Frequency</Label>
              <Select
                value={wizardData.recurringFrequency || ""}
                onChange={(e) => {
                  const freq = e.target.value as PaymentTerm["recurringFrequency"]
                  updateWizardData("recurringFrequency", freq || null)
                  updateWizardData("recurringCustomMonths", null)
                }}
              >
                <option value="">Select frequency</option>
                {RECURRING_FREQUENCIES.map((freq) => (
                  <option key={freq.value} value={freq.value}>
                    {freq.label}
                  </option>
                ))}
              </Select>
              {errors.recurringFrequency && (
                <p className="text-sm text-red-600">{errors.recurringFrequency}</p>
              )}
            </div>

            {wizardData.recurringFrequency === "CUSTOM" && (
              <div className="space-y-2">
                <Label>Custom Months</Label>
                <Input
                  type="number"
                  min="1"
                  value={wizardData.recurringCustomMonths || ""}
                  onChange={(e) => updateWizardData("recurringCustomMonths", parseInt(e.target.value) || null)}
                  placeholder="e.g., 2"
                />
                {errors.recurringCustomMonths && (
                  <p className="text-sm text-red-600">{errors.recurringCustomMonths}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={wizardData.recurringStartDate || getDefaultStartDate()}
                onChange={(e) => updateWizardData("recurringStartDate", e.target.value || null)}
              />
              {errors.recurringStartDate && (
                <p className="text-sm text-red-600">{errors.recurringStartDate}</p>
              )}
            </div>
          </div>
        )}

        {currentStep === 2 && paymentStructure === "INSTALLMENTS" && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">Installment Details</Label>
            
            <div className="space-y-2">
              <Label>Installment Type</Label>
              <Select
                value={wizardData.installmentType || ""}
                onChange={(e) => {
                  const type = e.target.value as PaymentTerm["installmentType"]
                  updateWizardData("installmentType", type || null)
                  updateWizardData("milestoneIds", [])
                  updateWizardData("installmentCount", null)
                  updateWizardData("installmentFrequency", null)
                }}
              >
                <option value="">Select type</option>
                <option value="TIME_BASED">Time-based</option>
                <option value="MILESTONE_BASED">Milestone-based</option>
              </Select>
              {errors.installmentType && (
                <p className="text-sm text-red-600">{errors.installmentType}</p>
              )}
            </div>

            {wizardData.installmentType === "TIME_BASED" && (
              <>
                <div className="space-y-2">
                  <Label>Number of Installments</Label>
                  <Input
                    type="number"
                    min="1"
                    value={wizardData.installmentCount || ""}
                    onChange={(e) => updateWizardData("installmentCount", parseInt(e.target.value) || null)}
                    placeholder="e.g., 4"
                  />
                  {errors.installmentCount && (
                    <p className="text-sm text-red-600">{errors.installmentCount}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={wizardData.installmentFrequency || ""}
                    onChange={(e) => {
                      const freq = e.target.value as PaymentTerm["installmentFrequency"]
                      updateWizardData("installmentFrequency", freq || null)
                    }}
                  >
                    <option value="">Select frequency</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                  </Select>
                  {errors.installmentFrequency && (
                    <p className="text-sm text-red-600">{errors.installmentFrequency}</p>
                  )}
                </div>
              </>
            )}

            {wizardData.installmentType === "MILESTONE_BASED" && milestones.length > 0 && (
              <div className="space-y-2">
                <Label>Select Milestones</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-3">
                  {milestones.map((milestone) => (
                    <label key={milestone.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={wizardData.milestoneIds?.includes(milestone.id) || false}
                        onChange={(e) => {
                          const currentIds = wizardData.milestoneIds || []
                          const updatedIds = e.target.checked
                            ? [...currentIds, milestone.id]
                            : currentIds.filter(id => id !== milestone.id)
                          updateWizardData("milestoneIds", updatedIds)
                        }}
                        className="rounded"
                      />
                      <span>{milestone.name}</span>
                    </label>
                  ))}
                </div>
                {errors.milestoneIds && (
                  <p className="text-sm text-red-600">{errors.milestoneIds}</p>
                )}
              </div>
            )}
          </div>
        )}

        {currentStep === 2 && paymentStructure === "ONE_TIME" && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-5 h-5 text-blue-600" />
                <Label className="text-base font-semibold text-blue-900">One-time Payment Selected</Label>
              </div>
              <p className="text-sm text-blue-800">
                The full balance will be due upon completion of the work.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Balance Payment Method (only for UPFRONT_BALANCE) */}
        {currentStep === 3 && paymentStructure === "UPFRONT_BALANCE" && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">How will the balance be paid?</Label>
            
            <div className="space-y-3">
              <label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="balancePaymentType"
                  value="MILESTONE_BASED"
                  checked={wizardData.balancePaymentType === "MILESTONE_BASED"}
                  onChange={() => updateWizardData("balancePaymentType", "MILESTONE_BASED")}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <div className="font-medium">Milestone-based</div>
                  <div className="text-sm text-gray-600">Balance paid upon completion of specific milestones</div>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="balancePaymentType"
                  value="TIME_BASED"
                  checked={wizardData.balancePaymentType === "TIME_BASED"}
                  onChange={() => updateWizardData("balancePaymentType", "TIME_BASED")}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <div className="font-medium">Time-based</div>
                  <div className="text-sm text-gray-600">Balance due on a specific date</div>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="balancePaymentType"
                  value="FULL_UPFRONT"
                  checked={wizardData.balancePaymentType === "FULL_UPFRONT"}
                  onChange={() => updateWizardData("balancePaymentType", "FULL_UPFRONT")}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <div className="font-medium">Full upfront (100%)</div>
                  <div className="text-sm text-gray-600">Entire amount paid upfront</div>
                </div>
              </label>
            </div>
            {errors.balancePaymentType && (
              <p className="text-sm text-red-600">{errors.balancePaymentType}</p>
            )}

            {wizardData.balancePaymentType === "TIME_BASED" && (
              <div className="space-y-2">
                <Label>Balance Due Date</Label>
                <Input
                  type="date"
                  value={wizardData.balanceDueDate || ""}
                  onChange={(e) => updateWizardData("balanceDueDate", e.target.value || null)}
                />
                {errors.balanceDueDate && (
                  <p className="text-sm text-red-600">{errors.balanceDueDate}</p>
                )}
              </div>
            )}

            {wizardData.balancePaymentType === "MILESTONE_BASED" && (
              <>
                {milestones.length > 0 ? (
                  <div className="space-y-2">
                    <Label>Select Milestones for Balance Payment</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-3">
                      {milestones.map((milestone) => (
                        <label key={milestone.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={wizardData.milestoneIds?.includes(milestone.id) || false}
                            onChange={(e) => {
                              const currentIds = wizardData.milestoneIds || []
                              const updatedIds = e.target.checked
                                ? [...currentIds, milestone.id]
                                : currentIds.filter(id => id !== milestone.id)
                              updateWizardData("milestoneIds", updatedIds)
                            }}
                            className="rounded"
                          />
                          <span>{milestone.name}</span>
                        </label>
                      ))}
                    </div>
                    {errors.milestoneIds && (
                      <p className="text-sm text-red-600">{errors.milestoneIds}</p>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> You haven&apos;t created any milestones yet. You&apos;ll be able to create milestones in the next step and then return here to assign them to the balance payment if needed.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
          
          <Button
            type="button"
            onClick={handleNext}
            disabled={currentStep === 1 && !paymentStructure}
            className="flex items-center gap-2"
          >
            {currentStep < getTotalSteps() ? (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Complete
              </>
            )}
          </Button>
        </div>

        {/* Completion Indicator */}
        {isCompleted() && currentStep === getTotalSteps() && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              <p className="text-sm font-medium text-green-900">
                Payment terms configured successfully
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
