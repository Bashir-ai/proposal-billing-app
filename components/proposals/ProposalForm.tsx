"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ProposalType } from "@prisma/client"
import { Plus, Trash2, X } from "lucide-react"
import { formatCurrency, formatClientName } from "@/lib/utils"
import { PaymentTermsWizard } from "./PaymentTermsWizard"
import { ProposalFormWizard } from "./ProposalFormWizard"
import { AddExpenseButton } from "./AddExpenseButton"
import { RetainerPaymentTerms } from "./RetainerPaymentTerms"
import { FixedFeeConfig, HourlyConfig, RetainerConfig, SuccessFeeConfig } from "./MixedModelConfigs"

interface ProposalFormProps {
  onSubmit: (data: any) => Promise<void>
  initialData?: any
  clients: Array<{ id: string; name: string; company?: string | null; defaultDiscountPercent?: number | null; defaultDiscountAmount?: number | null }>
  leads?: Array<{ id: string; name: string; company?: string | null }>
  users?: Array<{ id: string; name: string; email: string; defaultHourlyRate?: number | null }>
  loading?: boolean
  onLeadCreated?: (lead: { id: string; name: string; company?: string | null }) => void
  onClientCreated?: (client: { id: string; name: string; company?: string | null }) => void
}

interface ClientWithDiscounts {
  id: string
  name: string
  company?: string | null
  defaultDiscountPercent?: number | null
  defaultDiscountAmount?: number | null
}

interface LineItem {
  billingMethod?: string
  personId?: string
  description: string
  quantity?: number
  rate?: number
  unitPrice?: number
  discountPercent?: number
  discountAmount?: number
  amount: number
  date?: string
  milestoneIds?: string[] // Array of milestone IDs assigned to this item
  expenseId?: string // Reference to ProjectExpense if this is an expense line item
  // Recurring payment fields (when billingMethod is "RECURRING")
  recurringEnabled?: boolean
  recurringFrequency?: "MONTHLY_1" | "MONTHLY_3" | "MONTHLY_6" | "YEARLY_12" | "CUSTOM"
  recurringCustomMonths?: number
  recurringStartDate?: string
  // Estimate and capped flags (for hourly items)
  isEstimate?: boolean
  isCapped?: boolean
  cappedHours?: number
  cappedAmount?: number
  // Expense flag
  isEstimated?: boolean // For expense items
}

interface Milestone {
  id?: string // Temporary ID for tracking (index-based or UUID)
  name: string
  description?: string
  amount?: number
  percent?: number
  dueDate?: string
}

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
]

// Define wizard steps outside component to avoid recreating on every render
const ALL_WIZARD_STEPS = [
  { id: "billing", title: "Billing Method", required: true, conditional: false },
  { id: "payment", title: "Payment Terms", required: true, conditional: false },
  { id: "milestones", title: "Milestones", required: false, conditional: true },
  { id: "items", title: "Line Items", required: true, conditional: false },
  { id: "review", title: "Review", required: true, conditional: false },
]

export function ProposalForm({ onSubmit, initialData, clients, leads = [], users = [], loading, onLeadCreated, onClientCreated }: ProposalFormProps) {
  const today = new Date().toISOString().split("T")[0]
  const selectedClient = clients.find(c => c.id === (initialData?.clientId || "")) as ClientWithDiscounts | undefined
  
  const [formData, setFormData] = useState({
    clientId: initialData?.clientId || "",
    leadId: initialData?.leadId || "",
    type: (initialData?.type || "HOURLY") as ProposalType,
    title: initialData?.title || "",
    description: initialData?.description || "",
    proposalNumber: initialData?.proposalNumber || "",
    issueDate: initialData?.issueDate ? new Date(initialData.issueDate).toISOString().split("T")[0] : today,
    expiryDate: initialData?.expiryDate ? new Date(initialData.expiryDate).toISOString().split("T")[0] : "",
    currency: initialData?.currency || "EUR",
    taxInclusive: initialData?.taxInclusive ?? false,
    taxRate: initialData?.taxRate || 0,
    clientDiscountType: initialData?.clientDiscountPercent ? "percent" : initialData?.clientDiscountAmount ? "amount" : "none",
    clientDiscountPercent: initialData?.clientDiscountPercent || 0,
    clientDiscountAmount: initialData?.clientDiscountAmount || 0,
    // Billing method specific fields
    estimatedHours: initialData?.estimatedHours || 0,
    hourlyRateRangeMin: initialData?.hourlyRateRangeMin || 0,
    hourlyRateRangeMax: initialData?.hourlyRateRangeMax || 0,
    hourlyCapHours: initialData?.hourlyCapHours || 0,
    cappedAmount: initialData?.cappedAmount || 0,
    hourlyRateTableType: initialData?.hourlyRateTableType || "FIXED_RATE",
    hourlyRateTableRates: initialData?.hourlyRateTableRates ? (typeof initialData.hourlyRateTableRates === 'string' ? JSON.parse(initialData.hourlyRateTableRates) : initialData.hourlyRateTableRates) : null,
    retainerMonthlyAmount: initialData?.retainerMonthlyAmount || 0,
    retainerHoursPerMonth: initialData?.retainerHoursPerMonth || 0,
    retainerAdditionalHoursType: initialData?.retainerAdditionalHoursType || "FIXED_RATE", // FIXED_RATE, RATE_RANGE, BLENDED_RATE
    retainerAdditionalHoursRate: initialData?.retainerAdditionalHoursRate || 0,
    retainerAdditionalHoursRateMin: initialData?.retainerAdditionalHoursRateMin || 0,
    retainerAdditionalHoursRateMax: initialData?.retainerAdditionalHoursRateMax || 0,
    retainerAdditionalHoursBlendedRate: initialData?.retainerAdditionalHoursBlendedRate || 0,
    retainerStartDate: initialData?.retainerStartDate ? new Date(initialData.retainerStartDate).toISOString().split("T")[0] : "",
    retainerDurationMonths: initialData?.retainerDurationMonths || null,
    retainerProjectScope: initialData?.retainerProjectScope || "ALL_PROJECTS",
    retainerProjectIds: initialData?.retainerProjectIds || [],
    retainerExcessBillingType: initialData?.retainerExcessBillingType || null,
    retainerUnusedBalancePolicy: initialData?.retainerUnusedBalancePolicy || null,
    retainerUnusedBalanceExpiryMonths: initialData?.retainerUnusedBalanceExpiryMonths || null,
    retainerHourlyTableRates: initialData?.retainerHourlyTableRates ? (typeof initialData.retainerHourlyTableRates === 'string' ? JSON.parse(initialData.retainerHourlyTableRates) : initialData.retainerHourlyTableRates) : null,
    blendedRate: initialData?.blendedRate || 0,
    useBlendedRate: initialData?.useBlendedRate ?? false,
    successFeePercent: initialData?.successFeePercent || 0,
    successFeeAmount: initialData?.successFeeAmount || 0,
    successFeeValue: initialData?.successFeeValue || 0,
    successFeeBaseType: initialData?.successFeeBaseType || "FIXED_AMOUNT", // FIXED_AMOUNT or HOURLY_RATE
    successFeeBaseAmount: initialData?.successFeeBaseAmount || 0,
    successFeeBaseHourlyRate: initialData?.successFeeBaseHourlyRate || 0,
    successFeeBaseHourlyDescription: initialData?.successFeeBaseHourlyDescription || "",
    successFeeType: initialData?.successFeeType || "PERCENTAGE", // PERCENTAGE or FIXED_AMOUNT
    fixedAmount: initialData?.fixedAmount || 0,
    outOfScopeHourlyRate: initialData?.outOfScopeHourlyRate || 0,
    // Mixed model billing methods (array of selected methods)
    mixedModelMethods: initialData?.mixedModelMethods || [],
    useMilestones: initialData?.milestones && initialData.milestones.length > 0 ? true : false, // Enable if milestones exist
    // Proposal-level defaults for hourly items
    hourlyIsEstimate: initialData?.hourlyIsEstimate ?? false,
    hourlyIsCapped: initialData?.hourlyIsCapped ?? false,
    // Recurring payment fields (for RECURRING proposal type)
    recurringEnabled: initialData?.recurringEnabled || false,
    recurringFrequency: initialData?.recurringFrequency || undefined,
    recurringCustomMonths: initialData?.recurringCustomMonths || undefined,
    recurringStartDate: initialData?.recurringStartDate ? new Date(initialData.recurringStartDate).toISOString().split("T")[0] : undefined,
  })

  // Track which discount field was last edited for each item to prevent auto-calculation loops
  const [discountEditSource, setDiscountEditSource] = useState<Record<number, "percent" | "amount" | null>>({})
  
  const [items, setItems] = useState<LineItem[]>(initialData?.items?.map((item: any) => ({
    billingMethod: item.billingMethod || undefined,
    personId: item.personId || undefined,
    description: item.description || "",
    quantity: item.quantity || undefined,
    rate: item.rate || undefined,
    unitPrice: item.unitPrice || undefined,
    discountPercent: item.discountPercent || undefined,
    discountAmount: item.discountAmount || undefined,
    amount: item.amount || 0,
    // date field removed - dates are only for actual billing/timesheet entries
    milestoneIds: item.milestones?.map((m: any) => m.id) || [], // Get milestone IDs from relations
    // Expense fields - explicitly set to ensure proper categorization
    expenseId: item.expenseId || undefined,
    // Recurring payment fields
    recurringEnabled: item.recurringEnabled || false,
    recurringFrequency: item.recurringFrequency || undefined,
    recurringCustomMonths: item.recurringCustomMonths || undefined,
    recurringStartDate: item.recurringStartDate ? new Date(item.recurringStartDate).toISOString().split("T")[0] : undefined,
    // Estimate and capped flags
    isEstimate: item.isEstimate || false,
    isCapped: item.isCapped || false,
    cappedHours: item.cappedHours || undefined,
    cappedAmount: item.cappedAmount || undefined,
    // Expense flag - explicitly set to false if not an expense
    isEstimated: item.isEstimated || false,
  })) || [])

  // Initialize milestones with temporary IDs (using index for now, will be replaced with DB IDs on save)
  const [milestones, setMilestones] = useState<Milestone[]>(initialData?.milestones?.map((m: any, index: number) => ({
    id: m.id || `temp-${index}`, // Use DB ID if exists, otherwise temp ID
    name: m.name || "",
    description: m.description || "",
    amount: m.amount || undefined,
    percent: m.percent || undefined,
    dueDate: m.dueDate ? new Date(m.dueDate).toISOString().split("T")[0] : undefined,
  })) || [])

  const [availableTags, setAvailableTags] = useState<Array<{ id: string; name: string; color?: string | null }>>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(initialData?.tags?.map((t: any) => t.id) || [])
  const [customTags, setCustomTags] = useState<string[]>(initialData?.customTags || [])
  const [newCustomTag, setNewCustomTag] = useState("")
  
  // Payment terms should be explicitly configured by user (no auto-defaults)
  const [proposalPaymentTerm, setProposalPaymentTerm] = useState<any>(
    initialData?.paymentTerms?.find((pt: any) => !pt.proposalItemId) || null
  )
  const [itemPaymentTerms, setItemPaymentTerms] = useState<Array<any>>(
    items.map((_, index) => initialData?.paymentTerms?.find((pt: any) => pt.proposalItemId === initialData?.items?.[index]?.id) || null)
  )

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showCreateLeadDialog, setShowCreateLeadDialog] = useState(false)
  const [clientProjects, setClientProjects] = useState<Array<{id: string, name: string}>>([])
  
  // Wizard state management
  const shouldShowMilestonesStep = useMemo(() => {
    return formData.type === "FIXED_FEE" || formData.type === "MIXED_MODEL"
  }, [formData.type])
  
  const wizardSteps = useMemo(() => {
    return ALL_WIZARD_STEPS.filter(step => {
      // Filter out milestones step if not applicable
      if (step.id === "milestones" && !shouldShowMilestonesStep) {
        return false
      }
      // Filter out line items step for RETAINER proposals
      if (step.id === "items" && formData.type === "RETAINER") {
        return false
      }
      return true
    })
  }, [shouldShowMilestonesStep, formData.type])
  
  const [currentWizardStep, setCurrentWizardStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  
  // Initialize wizard state for editing
  useEffect(() => {
    if (initialData) {
      // If editing, mark steps as completed and jump to review if all filled
      const completed = new Set<string>()
      if (initialData.type) completed.add("billing")
      if (initialData.type === "RETAINER") {
        // For retainer, check retainer payment terms
        if (initialData.retainerUnusedBalancePolicy) {
          completed.add("payment")
        }
      } else if (proposalPaymentTerm) {
        completed.add("payment")
      }
      if (shouldShowMilestonesStep && milestones.length > 0) completed.add("milestones")
      // For RETAINER, items step is skipped, so mark it as completed
      if (initialData.type === "RETAINER" || items.length > 0 || milestones.length > 0) completed.add("items")
      setCompletedSteps(completed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch projects for selected client when retainer proposal
  useEffect(() => {
    const fetchProjects = async () => {
      if ((formData.type === "RETAINER" || (formData.type === "MIXED_MODEL" && formData.mixedModelMethods.includes("RETAINER"))) && formData.clientId) {
        try {
          const response = await fetch(`/api/projects?clientId=${formData.clientId}`)
          if (response.ok) {
            const projects = await response.json()
            setClientProjects(projects.filter((p: any) => p.status === "ACTIVE").map((p: any) => ({ id: p.id, name: p.name })))
          }
        } catch (error) {
          console.error("Error fetching projects:", error)
          setClientProjects([])
        }
      } else {
        setClientProjects([])
      }
    }
    fetchProjects()
  }, [formData.clientId, formData.type, formData.mixedModelMethods])
  
  // Wizard step validation
  const validateCurrentStep = (): boolean => {
    const currentStepId = wizardSteps[currentWizardStep]?.id
    const newErrors: Record<string, string> = {}
    
    if (currentStepId === "billing") {
      if (!formData.type) {
        newErrors.type = "Please select a billing method"
        setErrors(newErrors)
        return false
      }
      
      // For mixed model proposals, validate selected methods
      if (formData.type === "MIXED_MODEL") {
        if (formData.mixedModelMethods.length === 0) {
          newErrors.mixedModelMethods = "Please select at least one billing method"
          setErrors(newErrors)
          return false
        }
        
        // Validate each selected method's required fields
        if (formData.mixedModelMethods.includes("RETAINER")) {
          if (!formData.retainerMonthlyAmount || formData.retainerMonthlyAmount <= 0) {
            newErrors.retainerMonthlyAmount = "Please specify monthly retainer amount"
            setErrors(newErrors)
            return false
          }
          if (!formData.retainerHoursPerMonth || formData.retainerHoursPerMonth <= 0) {
            newErrors.retainerHoursPerMonth = "Please specify hours per month"
            setErrors(newErrors)
            return false
          }
          if (formData.retainerProjectScope === "SPECIFIC_PROJECTS" && formData.retainerProjectIds.length === 0) {
            newErrors.retainerProjectIds = "Please select at least one project"
            setErrors(newErrors)
            return false
          }
        }
        
        if (formData.mixedModelMethods.includes("SUCCESS_FEE")) {
          if (formData.successFeeBaseType === "FIXED_AMOUNT" && (!formData.successFeeBaseAmount || formData.successFeeBaseAmount <= 0)) {
            newErrors.successFeeBaseAmount = "Please specify base fee amount"
            setErrors(newErrors)
            return false
          }
          if (formData.successFeeBaseType === "HOURLY_RATE") {
            if (!formData.successFeeBaseHourlyRate || formData.successFeeBaseHourlyRate <= 0) {
              newErrors.successFeeBaseHourlyRate = "Please specify base hourly rate"
              setErrors(newErrors)
              return false
            }
            if (!formData.successFeeBaseHourlyDescription) {
              newErrors.successFeeBaseHourlyDescription = "Please provide a description for the hourly rate"
              setErrors(newErrors)
              return false
            }
          }
          if (formData.successFeeType === "PERCENTAGE") {
            if (!formData.successFeePercent || formData.successFeePercent <= 0) {
              newErrors.successFeePercent = "Please specify success fee percentage"
              setErrors(newErrors)
              return false
            }
            if (!formData.successFeeValue || formData.successFeeValue <= 0) {
              newErrors.successFeeValue = "Please specify transaction/deal value"
              setErrors(newErrors)
              return false
            }
          }
          if (formData.successFeeType === "FIXED_AMOUNT" && (!formData.successFeeAmount || formData.successFeeAmount <= 0)) {
            newErrors.successFeeAmount = "Please specify fixed success fee amount"
            setErrors(newErrors)
            return false
          }
        }
      }
      
      // For retainer proposals, validate project selection if specific projects is chosen
      if (formData.type === "RETAINER" && formData.retainerProjectScope === "SPECIFIC_PROJECTS" && formData.retainerProjectIds.length === 0) {
        newErrors.retainerProjectIds = "Please select at least one project"
        setErrors(newErrors)
        return false
      }
      setCompletedSteps(prev => new Set(prev).add("billing"))
      return true
    }
    
    if (currentStepId === "payment") {
      // For retainer proposals or mixed model with retainer, validate retainer payment terms
      if (formData.type === "RETAINER" || (formData.type === "MIXED_MODEL" && formData.mixedModelMethods.includes("RETAINER"))) {
        if (!formData.retainerUnusedBalancePolicy) {
          newErrors.paymentTerms = "Please select unused balance policy"
          setErrors(newErrors)
          return false
        }
        // For EXPIRE (expires at end of month), expiryMonths should be null
        // For ROLLOVER, expiryMonths must be set (not null and > 0)
        if (formData.retainerUnusedBalancePolicy === "ROLLOVER" && (!formData.retainerUnusedBalanceExpiryMonths || formData.retainerUnusedBalanceExpiryMonths <= 0)) {
          newErrors.paymentTerms = "Please specify the number of months for rollover"
          setErrors(newErrors)
          return false
        }
      }
      
      // For mixed model proposals without retainer, or non-retainer proposals, validate standard payment terms
      if (formData.type === "MIXED_MODEL" && !formData.mixedModelMethods.includes("RETAINER")) {
        // Mixed model without retainer needs standard payment terms
        if (!proposalPaymentTerm) {
          newErrors.paymentTerms = "Please configure payment terms using the wizard above"
          setErrors(newErrors)
          return false
        }
      } else if (formData.type !== "RETAINER") {
        // For non-retainer proposals, validate standard payment terms
        if (!proposalPaymentTerm) {
          newErrors.paymentTerms = "Please configure payment terms using the wizard above"
          setErrors(newErrors)
          return false
        }
      }
      setCompletedSteps(prev => new Set(prev).add("payment"))
      return true
    }
    
    if (currentStepId === "milestones") {
      // Milestones step is optional - allow skipping if no milestones defined
      // But if billing method requires milestones (FIXED_FEE), at least one should be defined
      if (formData.useMilestones && milestones.length === 0) {
        newErrors.milestones = "Please define at least one milestone or disable milestone payments"
        setErrors(newErrors)
        return false
      }
      if (milestones.length > 0) {
        setCompletedSteps(prev => new Set(prev).add("milestones"))
      }
      return true
    }
    
    if (currentStepId === "items") {
      // At least one line item OR milestone must exist
      // Skip items validation for RETAINER proposals (they don't use line items)
      if (formData.type === "RETAINER") {
        setCompletedSteps(prev => new Set(prev).add("items"))
        return true
      }
      if (items.length === 0 && milestones.length === 0) {
        newErrors.items = "Please add at least one line item or milestone"
        setErrors(newErrors)
        return false
      }
      setCompletedSteps(prev => new Set(prev).add("items"))
      return true
    }
    
    return true
  }
  
  const handleWizardNext = (): boolean => {
    if (validateCurrentStep()) {
      setErrors({})
      return true
    }
    return false
  }
  
  const handleWizardBack = () => {
    setErrors({})
  }
  
  const handleWizardStepChange = (step: number) => {
    setCurrentWizardStep(step)
    setErrors({})
  }
  
  const canProceedToNextStep = (): boolean => {
    const currentStepId = wizardSteps[currentWizardStep]?.id
    
    if (currentStepId === "billing") {
      return !!formData.type
    }
    
    if (currentStepId === "payment") {
      return !!proposalPaymentTerm
    }
    
    if (currentStepId === "milestones") {
      // Optional step - can always proceed
      return true
    }
    
    if (currentStepId === "items") {
      return items.length > 0 || milestones.length > 0
    }
    
    if (currentStepId === "review") {
      // For retainer proposals, only need billing and payment steps
      if (formData.type === "RETAINER") {
        return completedSteps.has("billing") && completedSteps.has("payment")
      }
      return completedSteps.has("billing") && completedSteps.has("payment") && (completedSteps.has("items") || completedSteps.has("milestones"))
    }
    
    return false
  }
  
  // Recalculate wizard steps when billing method changes
  useEffect(() => {
    // If switching away from a method that requires milestones, clear milestones
    if (!shouldShowMilestonesStep && formData.useMilestones) {
      setFormData(prev => ({ ...prev, useMilestones: false }))
      setMilestones([])
    }
    
    // If current step is beyond available steps, adjust
    if (currentWizardStep >= wizardSteps.length) {
      setCurrentWizardStep(Math.max(0, wizardSteps.length - 1))
    }
    
    // If we're on the milestones step and it's no longer applicable, move to next step
    if (wizardSteps[currentWizardStep]?.id === "milestones" && !shouldShowMilestonesStep) {
      // Skip to next step (items)
      const itemsStepIndex = wizardSteps.findIndex(s => s.id === "items")
      if (itemsStepIndex >= 0) {
        setCurrentWizardStep(itemsStepIndex)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.type, shouldShowMilestonesStep, wizardSteps, currentWizardStep])
  
  const [creatingLead, setCreatingLead] = useState(false)
  const [newLeadData, setNewLeadData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
  })
  const [showCreateClientDialog, setShowCreateClientDialog] = useState(false)
  const [creatingClient, setCreatingClient] = useState(false)
  const [newClientData, setNewClientData] = useState({
    name: "",
    email: "",
    company: "",
    contactInfo: "",
  })

  // Fetch available tags
  useEffect(() => {
    fetch("/api/proposal-tags")
      .then((res) => res.json())
      .then((data) => setAvailableTags(data))
      .catch(console.error)
  }, [])

  // Apply client default discount when client changes
  useEffect(() => {
    if (formData.clientId && selectedClient) {
      if (selectedClient.defaultDiscountPercent) {
        setFormData(prev => ({
          ...prev,
          clientDiscountType: "percent",
          clientDiscountPercent: selectedClient.defaultDiscountPercent || 0,
        }))
      } else if (selectedClient.defaultDiscountAmount) {
        setFormData(prev => ({
          ...prev,
          clientDiscountType: "amount",
          clientDiscountAmount: selectedClient.defaultDiscountAmount || 0,
        }))
      }
    }
  }, [formData.clientId, selectedClient])

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation() // Prevent bubbling to parent form
    if (!newLeadData.name.trim()) return

    setCreatingLead(true)
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newLeadData.name.trim(),
          email: newLeadData.email.trim() || null,
          company: newLeadData.company.trim() || null,
          phone: newLeadData.phone.trim() || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Failed to create lead" }))
        throw new Error(data.error || `Failed to create lead: ${response.status} ${response.statusText}`)
      }

      const newLead = await response.json()
      setShowCreateLeadDialog(false)
      setNewLeadData({ name: "", email: "", company: "", phone: "" })
      
      // Notify parent to refresh leads list
      if (onLeadCreated) {
        onLeadCreated(newLead)
      }
      
      // Select the newly created lead
      setFormData(prev => ({ ...prev, leadId: newLead.id, clientId: "" }))
    } catch (err: any) {
      console.error("Error creating lead:", err)
      alert(err.message || "Failed to create lead. Please check the console for details.")
    } finally {
      setCreatingLead(false)
    }
  }

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation() // Prevent bubbling to parent form
    if (!newClientData.name.trim()) return

    setCreatingClient(true)
    try {
      // Build request body matching API schema
      // Schema expects: email can be valid email string, undefined, or empty string ""
      const requestBody: any = {
        name: newClientData.name.trim(),
      }
      
      // Email: send empty string if empty (schema allows "" or valid email)
      const emailValue = newClientData.email.trim()
      requestBody.email = emailValue || ""
      
      // Optional fields: only include if they have values
      if (newClientData.company.trim()) {
        requestBody.company = newClientData.company.trim()
      }
      if (newClientData.contactInfo.trim()) {
        requestBody.contactInfo = newClientData.contactInfo.trim()
      }

      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Failed to create client" }))
        throw new Error(data.error || `Failed to create client: ${response.status} ${response.statusText}`)
      }

      const newClient = await response.json()
      setShowCreateClientDialog(false)
      setNewClientData({ name: "", email: "", company: "", contactInfo: "" })
      
      // Notify parent to refresh clients list
      if (onClientCreated) {
        onClientCreated(newClient)
      }
      
      // Select the newly created client
      setFormData(prev => ({ ...prev, clientId: newClient.id, leadId: "" }))
    } catch (err: any) {
      console.error("Error creating client:", err)
      alert(err.message || "Failed to create client. Please check the console for details.")
    } finally {
      setCreatingClient(false)
    }
  }

  const calculateLineItemAmount = (item: LineItem): number => {
    if (item.quantity && item.rate) {
      return item.quantity * item.rate
    }
    return item.amount || 0
  }

  const calculateSubtotal = (): number => {
    return items.reduce((sum, item) => {
      const itemAmount = item.amount || 0
      const itemDiscount = item.discountAmount || (item.discountPercent && itemAmount ? (itemAmount * item.discountPercent / 100) : 0) || 0
      return sum + (itemAmount - itemDiscount)
    }, 0)
  }

  // Calculate services subtotal (excluding expenses)
  // Services: Items without expenseId AND not marked as estimated expenses
  const calculateServicesSubtotal = (): number => {
    return items
      .filter(item => {
        const hasExpenseId = item.expenseId !== null && item.expenseId !== undefined && item.expenseId !== ""
        const isEstimatedExpense = item.isEstimated === true
        return !hasExpenseId && !isEstimatedExpense
      })
      .reduce((sum, item) => {
        const itemAmount = item.amount || 0
        const itemDiscount = item.discountAmount || (item.discountPercent && itemAmount ? (itemAmount * item.discountPercent / 100) : 0) || 0
        return sum + (itemAmount - itemDiscount)
      }, 0)
  }

  // Calculate expenses subtotal
  // Expenses: Items with expenseId OR marked as estimated expenses
  const calculateExpensesSubtotal = (): number => {
    return items
      .filter(item => {
        const hasExpenseId = item.expenseId !== null && item.expenseId !== undefined && item.expenseId !== ""
        const isEstimatedExpense = item.isEstimated === true
        return hasExpenseId || isEstimatedExpense
      })
      .reduce((sum, item) => {
        const itemAmount = item.amount || 0
        const itemDiscount = item.discountAmount || (item.discountPercent && itemAmount ? (itemAmount * item.discountPercent / 100) : 0) || 0
        return sum + (itemAmount - itemDiscount)
      }, 0)
  }

  const calculateClientDiscount = (): number => {
    // Calculate subtotal excluding expenses for discount calculation
    const servicesSubtotal = calculateServicesSubtotal()
    
    if (formData.clientDiscountType === "percent") {
      return servicesSubtotal * (formData.clientDiscountPercent / 100)
    } else if (formData.clientDiscountType === "amount") {
      return formData.clientDiscountAmount
    }
    return 0
  }

  const calculateTax = (): number => {
    if (!formData.taxRate || formData.taxRate === 0) return 0
    // Calculate subtotal excluding expenses
    // Services: Items without expenseId AND not marked as estimated expenses
    const subtotalExcludingExpenses = items
      .filter(item => {
        const hasExpenseId = item.expenseId !== null && item.expenseId !== undefined && item.expenseId !== ""
        const isEstimatedExpense = item.isEstimated === true
        return !hasExpenseId && !isEstimatedExpense
      }) // Exclude expenses
      .reduce((sum, item) => {
        const itemAmount = item.amount || 0
        const itemDiscount = item.discountAmount || (item.discountPercent && itemAmount ? (itemAmount * item.discountPercent / 100) : 0) || 0
        return sum + (itemAmount - itemDiscount)
      }, 0)
    const afterDiscount = subtotalExcludingExpenses - calculateClientDiscount()
    
    if (formData.taxInclusive) {
      // Tax is already included, calculate the tax portion
      return afterDiscount * (formData.taxRate / (100 + formData.taxRate))
    } else {
      // Tax is added on top
      return afterDiscount * (formData.taxRate / 100)
    }
  }

  const calculateGrandTotal = (): number => {
    const servicesSubtotal = calculateServicesSubtotal()
    const expensesSubtotal = calculateExpensesSubtotal()
    const discount = calculateClientDiscount()
    const tax = calculateTax()
    const servicesAfterDiscount = servicesSubtotal - discount
    
    if (formData.taxInclusive) {
      return servicesAfterDiscount + expensesSubtotal
    } else {
      return servicesAfterDiscount + tax + expensesSubtotal
    }
  }

  // Separate items into services and expenses
  // Services: Items without expenseId AND not marked as estimated expenses
  // Expenses: Items with expenseId OR marked as estimated expenses
  // Make filters explicit to ensure mutual exclusivity
  const servicesItems = items.filter(item => {
    const hasExpenseId = item.expenseId !== null && item.expenseId !== undefined && item.expenseId !== ""
    const isEstimatedExpense = item.isEstimated === true
    return !hasExpenseId && !isEstimatedExpense
  })
  const expensesItems = items.filter(item => {
    const hasExpenseId = item.expenseId !== null && item.expenseId !== undefined && item.expenseId !== ""
    const isEstimatedExpense = item.isEstimated === true
    return hasExpenseId || isEstimatedExpense
  })

  const addItem = () => {
    const newItem: LineItem = {
      description: "",
      amount: 0,
      // Explicitly set expense flags to false/undefined for manually added services
      expenseId: undefined,
      isEstimated: false,
    }
    
    // Set default billing method for mixed model
    if (formData.type === "MIXED_MODEL" && formData.mixedModelMethods.length > 0) {
      newItem.billingMethod = formData.mixedModelMethods[0]
    } else if (formData.type !== "MIXED_MODEL") {
      // For non-mixed models, set the billing method to match the proposal type
      newItem.billingMethod = formData.type
    }
    
    // Apply blended rate as default if enabled and item is hourly
    if (formData.useBlendedRate && formData.blendedRate > 0 && 
        (newItem.billingMethod === "HOURLY" || formData.type === "HOURLY" || formData.type === "MIXED_MODEL")) {
      newItem.rate = formData.blendedRate
    }
    
    // Apply proposal-level defaults for hourly items
    if (newItem.billingMethod === "HOURLY" || formData.type === "HOURLY") {
      newItem.isEstimate = formData.hourlyIsEstimate
      newItem.isCapped = formData.hourlyIsCapped
    }
    
    setItems([...items, newItem])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...items]
    const currentItem = updated[index]
    
    // Prevent accidentally setting expense flags for manually added services
    // Only allow expenseId and isEstimated to be set if the item is actually an expense
    if (field === "expenseId" || field === "isEstimated") {
      // If this is a manually added service (no expenseId), prevent it from being marked as expense
      if (!currentItem.expenseId && field === "isEstimated" && value === true) {
        // Don't allow manually added services to be marked as estimated expenses
        return
      }
      // Allow expenseId to be cleared, but prevent manually added services from getting an expenseId
      if (field === "expenseId" && value && !currentItem.expenseId && !currentItem.isEstimated) {
        // Don't allow manually added services to get an expenseId
        return
      }
    }
    
    updated[index] = { ...currentItem, [field]: value }
    
    // Clear capped fields when isCapped is set to false
    if (field === "isCapped" && value === false) {
      updated[index].cappedHours = undefined
      updated[index].cappedAmount = undefined
    }
    
    // Apply blended rate when switching to hourly or when blended rate is enabled
    if (field === "billingMethod" && value === "HOURLY" && formData.useBlendedRate && formData.blendedRate > 0) {
      updated[index].rate = formData.blendedRate
    }
    
    // Auto-fill rate from person's default rate (unless blended rate is enabled)
    if (field === "personId" && value) {
      const person = users.find(u => u.id === value)
      if (person?.defaultHourlyRate) {
        // Use blended rate if enabled, otherwise use person's default rate
        updated[index].rate = (formData.useBlendedRate && formData.blendedRate > 0) 
          ? formData.blendedRate 
          : person.defaultHourlyRate
        // Auto-calculate amount for hourly items
        if (formData.type === "HOURLY" || updated[index].billingMethod === "HOURLY") {
          const hours = updated[index].quantity || 0
          const rate = updated[index].rate || 0
          updated[index].amount = hours * rate
        } else {
          updated[index].amount = calculateLineItemAmount(updated[index])
        }
      }
    }
    
    // Auto-calculate amount for hourly items when quantity or rate changes
    if ((formData.type === "HOURLY" || currentItem.billingMethod === "HOURLY") && 
        (field === "quantity" || field === "rate")) {
      const hours = field === "quantity" ? (value || 0) : (updated[index].quantity || 0)
      const rate = field === "rate" ? (value || 0) : (updated[index].rate || 0)
      updated[index].amount = hours * rate
    }
    
    // Auto-calculate amount for Fixed Fee items when quantity or unitPrice changes
    if (formData.type === "FIXED_FEE" && (field === "quantity" || field === "unitPrice")) {
      const quantity = field === "quantity" ? (value || 1) : (updated[index].quantity || 1)
      const unitPrice = field === "unitPrice" ? (value || 0) : (updated[index].unitPrice || 0)
      updated[index].amount = quantity * unitPrice
    }
    
    setItems(updated)
  }

  const addMilestone = () => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    setMilestones([...milestones, { id: tempId, name: "", description: "", amount: undefined, percent: undefined }])
  }

  const removeMilestone = (index: number) => {
    const milestoneToRemove = milestones[index]
    const updatedMilestones = milestones.filter((_, i) => i !== index)
    setMilestones(updatedMilestones)
    
    // Remove this milestone from all line items that reference it
    if (milestoneToRemove.id) {
      const updatedItems = items.map(item => ({
        ...item,
        milestoneIds: item.milestoneIds?.filter(id => id !== milestoneToRemove.id) || []
      }))
      setItems(updatedItems)
    }
  }

  const updateMilestone = (index: number, field: keyof Milestone, value: any) => {
    const updated = [...milestones]
    updated[index] = { ...updated[index], [field]: value }
    setMilestones(updated)
  }

  const updateItemMilestones = (itemIndex: number, milestoneIds: string[]) => {
    const updated = [...items]
    updated[itemIndex] = { ...updated[itemIndex], milestoneIds }
    setItems(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    // Validation
    if (!formData.clientId && !formData.leadId) {
      setErrors({ clientId: "Please select either a client or a lead", leadId: "Please select either a client or a lead" })
      return
    }

    if (!formData.title) {
      setErrors({ title: "Title is required" })
      return
    }

    // Payment terms validation - must be explicitly configured (skip for retainer proposals)
    if (formData.type !== "RETAINER" && !proposalPaymentTerm) {
      setErrors({ paymentTerms: "Please configure payment terms using the wizard above" })
      return
    }

    if (formData.expiryDate && formData.issueDate && formData.expiryDate < formData.issueDate) {
      setErrors({ expiryDate: "Expiry date must be after issue date" })
      return
    }

    // Validation: if milestones are enabled, at least one milestone must be defined
    if (formData.useMilestones && milestones.length === 0) {
      setErrors({ milestones: "At least one milestone must be defined when milestones are enabled" })
      return
    }

    // Line items are optional for all billing methods (can use milestones instead)
    // Validation is handled by the check above (at least one line item or milestone)

    // Prepare submission data
    const submissionData: any = {
      ...formData,
      proposalNumber: formData.proposalNumber || undefined,
      issueDate: formData.issueDate || undefined,
      expiryDate: formData.expiryDate || undefined,
      clientDiscountPercent: formData.clientDiscountType === "percent" ? formData.clientDiscountPercent : undefined,
      clientDiscountAmount: formData.clientDiscountType === "amount" ? formData.clientDiscountAmount : undefined,
      tagIds: selectedTagIds,
      customTags: customTags.filter(t => t.trim() !== ""),
      // Recurring payment fields are now only in payment terms, not proposal type
      items: items.map(item => ({
        billingMethod: item.billingMethod || undefined,
        personId: item.personId || undefined,
        description: item.description,
        amount: item.amount || 0,
        quantity: item.quantity || undefined,
        rate: item.rate || undefined,
        unitPrice: item.unitPrice || undefined,
        expenseId: item.expenseId || undefined,
        // date field removed - dates are only for actual billing/timesheet entries
        milestoneIds: item.milestoneIds || [], // Include milestone IDs for this line item
        // Recurring payment fields are now only in payment terms, not as billing method
        // Estimate and capped flags
        isEstimate: item.isEstimate || undefined,
        isCapped: item.isCapped || undefined,
        cappedHours: item.cappedHours || undefined,
        cappedAmount: item.cappedAmount || undefined,
        // Expense flag
        isEstimated: item.isEstimated || undefined,
      })),
      milestones: formData.useMilestones && milestones.length > 0 ? milestones.map(m => ({
        id: m.id, // Include ID for matching on server
        name: m.name,
        description: m.description || undefined,
        amount: m.amount || undefined,
        percent: m.percent || undefined,
        dueDate: m.dueDate || undefined,
      })) : undefined,
      paymentTerms: formData.type !== "RETAINER" ? [
        // Proposal-level payment terms (mandatory - validated above)
        {
          ...proposalPaymentTerm,
          proposalId: undefined,
          proposalItemId: undefined,
        },
        // Include item-level payment terms if any
        ...items.map((_, index) => itemPaymentTerms[index]).filter(Boolean).map((term, index) => ({
          ...term,
          proposalId: undefined,
          proposalItemId: undefined, // Will be set on server
        })),
      ] : undefined,
      // Retainer-specific fields
      retainerStartDate: formData.retainerStartDate || undefined,
      retainerDurationMonths: formData.retainerDurationMonths ?? undefined,
      retainerProjectScope: formData.retainerProjectScope || undefined,
      retainerProjectIds: formData.retainerProjectIds || [],
      retainerUnusedBalancePolicy: formData.retainerUnusedBalancePolicy || undefined,
      retainerUnusedBalanceExpiryMonths: formData.retainerUnusedBalanceExpiryMonths ?? undefined,
      retainerHourlyTableRates: formData.retainerHourlyTableRates || undefined,
      hourlyRateTableType: formData.hourlyRateTableType || undefined,
      hourlyRateTableRates: formData.hourlyRateTableRates || undefined,
      amount: calculateGrandTotal(),
    }

    try {
      await onSubmit(submissionData)
    } catch (error: any) {
      // Display error to user
      const errorMessage = error?.message || "Failed to save proposal. Please try again."
      setErrors({ submit: errorMessage })
      // Scroll to top to show error
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const selectedCurrency = CURRENCIES.find(c => c.code === formData.currency) || CURRENCIES[0]

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      {errors.submit && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
          <p className="font-semibold">Error:</p>
          <p>{errors.submit}</p>
        </div>
      )}
      {/* Proposal Metadata Section */}
      <Card>
        <CardHeader>
          <CardTitle>Proposal Information</CardTitle>
          <CardDescription>Basic proposal details and metadata</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="clientId">Client</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateClientDialog(true)}
                  className="text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Create Client
                </Button>
              </div>
              <Select
                id="clientId"
                value={formData.clientId}
                onChange={(e) => {
                  const value = e.target.value
                  setFormData({ ...formData, clientId: value, leadId: value ? "" : formData.leadId })
                }}
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {formatClientName(client)} {client.company ? `(${client.company})` : ""}
                  </option>
                ))}
              </Select>
              {errors.clientId && (
                <p className="text-sm text-destructive">{errors.clientId}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="leadId">Lead</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateLeadDialog(true)}
                  className="text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Create Lead
                </Button>
              </div>
              <Select
                id="leadId"
                value={formData.leadId}
                onChange={(e) => {
                  const value = e.target.value
                  setFormData({ ...formData, leadId: value, clientId: value ? "" : formData.clientId })
                }}
              >
                <option value="">Select a lead</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name} {lead.company ? `(${lead.company})` : ""}
                  </option>
                ))}
              </Select>
              {errors.leadId && (
                <p className="text-sm text-destructive">{errors.leadId}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="proposalNumber">Proposal Number</Label>
              <Input
                id="proposalNumber"
                value={formData.proposalNumber}
                placeholder="Auto-generated"
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500">Will be generated automatically on save</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="issueDate">Issue Date *</Label>
              <Input
                id="issueDate"
                type="date"
                value={formData.issueDate}
                onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiryDate">Expiry Date</Label>
              <Input
                id="expiryDate"
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                min={formData.issueDate}
              />
              {errors.expiryDate && (
                <p className="text-sm text-destructive">{errors.expiryDate}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency *</Label>
              <Select
                id="currency"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />
          </div>

          {/* Tags Section - Internal Only */}
          <div className="space-y-2">
            <Label>Tags (Internal Only)</Label>
            <p className="text-xs text-gray-500 mb-2">
              Categorize this proposal by area of service or law. Tags are only visible internally.
            </p>
            
            {/* Predefined Tags */}
            {availableTags.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm">Predefined Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <label
                      key={tag.id}
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTagIds.includes(tag.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTagIds([...selectedTagIds, tag.id])
                          } else {
                            setSelectedTagIds(selectedTagIds.filter(id => id !== tag.id))
                          }
                        }}
                        className="rounded"
                      />
                      <span
                        className="px-2 py-1 rounded text-sm"
                        style={{
                          backgroundColor: tag.color ? `${tag.color}20` : "#3B82F620",
                          color: tag.color || "#3B82F6",
                        }}
                      >
                        {tag.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Tags */}
            <div className="space-y-2">
              <Label className="text-sm">Custom Tags</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {customTags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 rounded text-sm bg-gray-100 text-gray-700 flex items-center space-x-1"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => setCustomTags(customTags.filter((_, i) => i !== index))}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex space-x-2">
                <Input
                  type="text"
                  value={newCustomTag}
                  onChange={(e) => setNewCustomTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      if (newCustomTag.trim() && !customTags.includes(newCustomTag.trim())) {
                        setCustomTags([...customTags, newCustomTag.trim()])
                        setNewCustomTag("")
                      }
                    }
                  }}
                  placeholder="Type and press Enter to add custom tag"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (newCustomTag.trim() && !customTags.includes(newCustomTag.trim())) {
                      setCustomTags([...customTags, newCustomTag.trim()])
                      setNewCustomTag("")
                    }
                  }}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tax Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Tax Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="taxInclusive"
              checked={formData.taxInclusive}
              onChange={(e) => setFormData({ ...formData, taxInclusive: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor="taxInclusive">Tax Inclusive (tax included in amounts)</Label>
          </div>

          {formData.taxRate !== undefined && (
            <div className="space-y-2">
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
              <Select
                id="taxRate"
                value={formData.taxRate.toString()}
                onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
              >
                <option value="0">0%</option>
                <option value="16">16%</option>
                <option value="22">22%</option>
                <option value="23">23%</option>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client Discount */}
      <Card>
        <CardHeader>
          <CardTitle>Client Discount</CardTitle>
          <CardDescription>Apply a discount to the entire proposal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Discount Type</Label>
            <Select
              value={formData.clientDiscountType}
              onChange={(e) => setFormData({ ...formData, clientDiscountType: e.target.value })}
            >
              <option value="none">No Discount</option>
              <option value="percent">Percentage</option>
              <option value="amount">Fixed Amount</option>
            </Select>
          </div>

          {formData.clientDiscountType === "percent" && (
            <div className="space-y-2">
              <Label htmlFor="clientDiscountPercent">Discount Percentage (%)</Label>
              <Input
                id="clientDiscountPercent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.clientDiscountPercent}
                onChange={(e) => setFormData({ ...formData, clientDiscountPercent: parseFloat(e.target.value) || 0 })}
              />
            </div>
          )}

          {formData.clientDiscountType === "amount" && (
            <div className="space-y-2">
              <Label htmlFor="clientDiscountAmount">Discount Amount ({selectedCurrency.symbol})</Label>
              <Input
                id="clientDiscountAmount"
                type="number"
                step="0.01"
                min="0"
                value={formData.clientDiscountAmount}
                onChange={(e) => setFormData({ ...formData, clientDiscountAmount: parseFloat(e.target.value) || 0 })}
              />
            </div>
          )}

          {formData.clientDiscountType !== "none" && (
            <div className="p-3 bg-blue-50 rounded">
              <p className="text-sm">
                Discount: {formData.clientDiscountType === "percent" 
                  ? `${formData.clientDiscountPercent}%` 
                  : `${selectedCurrency.symbol}${formData.clientDiscountAmount.toFixed(2)}`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wizard Steps Section */}
      <ProposalFormWizard
        steps={wizardSteps.map(s => ({ id: s.id, title: s.title, required: s.required, conditional: s.conditional || false }))}
        currentStep={currentWizardStep}
        onStepChange={handleWizardStepChange}
        onNext={handleWizardNext}
        onBack={handleWizardBack}
        canGoNext={canProceedToNextStep()}
        isEditing={!!initialData}
      >
        {wizardSteps[currentWizardStep]?.id === "billing" && (
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Select Billing Method</CardTitle>
              <CardDescription>Choose how this proposal will be billed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">Billing Method *</Label>
                <Select
                  id="type"
                  value={formData.type}
                  onChange={(e) => {
                    const newType = e.target.value as ProposalType
                    // Disable blended rate for Fixed Fee and Retainer
                    setFormData({ 
                      ...formData, 
                      type: newType,
                      useBlendedRate: (newType === "FIXED_FEE" || newType === "RETAINER") ? false : formData.useBlendedRate,
                      blendedRate: (newType === "FIXED_FEE" || newType === "RETAINER") ? 0 : formData.blendedRate
                    })
                    setItems([])
                    setMilestones([])
                  }}
                >
                  <option value="">-- Select a billing method --</option>
                  <option value="FIXED_FEE">Fixed Fee (with milestones)</option>
                  <option value="HOURLY">Hourly (with estimate and range)</option>
                  <option value="RETAINER">Retainer (with drawdown rules)</option>
                  <option value="SUCCESS_FEE">Success Fee</option>
                  <option value="MIXED_MODEL">Mixed Model (Fixed + Hourly)</option>
                </Select>
                {errors.type && (
                  <p className="text-sm text-destructive">{errors.type}</p>
                )}
              </div>

              {/* Show billing method-specific configuration after selection */}
              {formData.type && (
                <div className="space-y-4 mt-6 pt-6 border-t">
                  {formData.type === "CAPPED_FEE" && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Capped Fee Configuration</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <Label htmlFor="cappedAmount">Cap Amount ({selectedCurrency.symbol})</Label>
                          <Input
                            id="cappedAmount"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.cappedAmount}
                            onChange={(e) => setFormData({ ...formData, cappedAmount: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}


                  {formData.type === "RETAINER" && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Retainer Configuration</CardTitle>
                        <CardDescription>Configure the retainer amount, included hours, and additional hours billing</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="retainerMonthlyAmount">Monthly Retainer Amount ({selectedCurrency.symbol}) *</Label>
                            <Input
                              id="retainerMonthlyAmount"
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.retainerMonthlyAmount}
                              onChange={(e) => setFormData({ ...formData, retainerMonthlyAmount: parseFloat(e.target.value) || 0 })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="retainerHoursPerMonth">Hours Per Month Included *</Label>
                            <Input
                              id="retainerHoursPerMonth"
                              type="number"
                              step="0.25"
                              min="0"
                              value={formData.retainerHoursPerMonth}
                              onChange={(e) => setFormData({ ...formData, retainerHoursPerMonth: parseFloat(e.target.value) || 0 })}
                              required
                            />
                            <p className="text-xs text-gray-500">Number of hours included in the monthly retainer</p>
                          </div>
                        </div>
                        
                        <div className="pt-4 border-t">
                          <Label className="text-base font-semibold mb-3 block">Additional Hours Configuration</Label>
                          <p className="text-sm text-gray-600 mb-4">How will hours beyond the retainer package be billed?</p>
                          
                          <div className="space-y-3 mb-4">
                            <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                              <input
                                type="radio"
                                name="retainerAdditionalHoursType"
                                value="FIXED_RATE"
                                checked={formData.retainerAdditionalHoursType === "FIXED_RATE"}
                                onChange={(e) => setFormData({ ...formData, retainerAdditionalHoursType: e.target.value })}
                                className="w-4 h-4"
                              />
                              <div className="flex-1">
                                <div className="font-medium">Fixed Hourly Rate</div>
                                <div className="text-sm text-gray-600">Charge a fixed rate per additional hour</div>
                              </div>
                            </label>
                            
                            <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                              <input
                                type="radio"
                                name="retainerAdditionalHoursType"
                                value="RATE_RANGE"
                                checked={formData.retainerAdditionalHoursType === "RATE_RANGE"}
                                onChange={(e) => setFormData({ ...formData, retainerAdditionalHoursType: e.target.value })}
                                className="w-4 h-4"
                              />
                              <div className="flex-1">
                                <div className="font-medium">Rate Range (Min/Max)</div>
                                <div className="text-sm text-gray-600">Charge within a rate range per additional hour</div>
                              </div>
                            </label>
                            
                            <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                              <input
                                type="radio"
                                name="retainerAdditionalHoursType"
                                value="HOURLY_TABLE"
                                checked={formData.retainerAdditionalHoursType === "HOURLY_TABLE"}
                                onChange={(e) => setFormData({ ...formData, retainerAdditionalHoursType: e.target.value })}
                                className="w-4 h-4"
                              />
                              <div className="flex-1">
                                <div className="font-medium">Hourly Table</div>
                                <div className="text-sm text-gray-600">Charge different rates based on user profile</div>
                              </div>
                            </label>
                          </div>
                          
                          {formData.retainerAdditionalHoursType === "FIXED_RATE" && (
                            <div className="space-y-2">
                              <Label htmlFor="retainerAdditionalHoursRate">Fixed Hourly Rate ({selectedCurrency.symbol}/hr) *</Label>
                              <Input
                                id="retainerAdditionalHoursRate"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.retainerAdditionalHoursRate}
                                onChange={(e) => setFormData({ ...formData, retainerAdditionalHoursRate: parseFloat(e.target.value) || 0 })}
                                required
                              />
                            </div>
                          )}
                          
                          {formData.retainerAdditionalHoursType === "RATE_RANGE" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="retainerAdditionalHoursRateMin">Minimum Rate ({selectedCurrency.symbol}/hr) *</Label>
                                <Input
                                  id="retainerAdditionalHoursRateMin"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={formData.retainerAdditionalHoursRateMin}
                                  onChange={(e) => setFormData({ ...formData, retainerAdditionalHoursRateMin: parseFloat(e.target.value) || 0 })}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="retainerAdditionalHoursRateMax">Maximum Rate ({selectedCurrency.symbol}/hr) *</Label>
                                <Input
                                  id="retainerAdditionalHoursRateMax"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={formData.retainerAdditionalHoursRateMax}
                                  onChange={(e) => setFormData({ ...formData, retainerAdditionalHoursRateMax: parseFloat(e.target.value) || 0 })}
                                  required
                                />
                              </div>
                            </div>
                          )}
                          
                          {formData.retainerAdditionalHoursType === "HOURLY_TABLE" && (
                            <div className="space-y-4">
                              <Label className="text-base font-semibold">Hourly Rates by Profile</Label>
                              <div className="space-y-2">
                                {[
                                  { key: "SECRETARIAT", label: "Secretariat" },
                                  { key: "TRAINEE", label: "Trainee" },
                                  { key: "JUNIOR_LAWYER", label: "Junior Lawyer" },
                                  { key: "LAWYER", label: "Lawyer" },
                                  { key: "SENIOR_LAWYER", label: "Senior Lawyer" },
                                  { key: "PARTNER", label: "Partner" },
                                ].map((profile) => (
                                  <div key={profile.key} className="grid grid-cols-2 gap-4 items-center">
                                    <Label>{profile.label}</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={formData.retainerHourlyTableRates?.[profile.key] || 0}
                                      onChange={(e) => {
                                        const newRates = { ...(formData.retainerHourlyTableRates || {}), [profile.key]: parseFloat(e.target.value) || 0 }
                                        setFormData({ ...formData, retainerHourlyTableRates: newRates })
                                      }}
                                      placeholder={`${selectedCurrency.symbol}/hr`}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="pt-4 border-t">
                          <Label className="text-base font-semibold mb-3 block">Monthly Retainer Configuration</Label>
                          <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="retainerStartDateEnabled"
                                checked={!!formData.retainerStartDate}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const defaultDate = new Date()
                                    defaultDate.setMonth(defaultDate.getMonth() + 1)
                                    defaultDate.setDate(1)
                                    setFormData({ ...formData, retainerStartDate: defaultDate.toISOString().split("T")[0] })
                                  } else {
                                    setFormData({ ...formData, retainerStartDate: "" })
                                  }
                                }}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                              <Label htmlFor="retainerStartDateEnabled" className="cursor-pointer">
                                Start charging on specific date
                              </Label>
                            </div>
                            {formData.retainerStartDate && (
                              <div className="space-y-2">
                                <Label htmlFor="retainerStartDate">Start Date *</Label>
                                <Input
                                  id="retainerStartDate"
                                  type="date"
                                  value={formData.retainerStartDate}
                                  onChange={(e) => setFormData({ ...formData, retainerStartDate: e.target.value })}
                                  required
                                />
                              </div>
                            )}
                            <div className="space-y-2">
                              <Label htmlFor="retainerDuration">Duration *</Label>
                              <select
                                id="retainerDuration"
                                value={formData.retainerDurationMonths || ""}
                                onChange={(e) => {
                                  const value = e.target.value
                                  if (value === "CUSTOM") {
                                    setFormData({ ...formData, retainerDurationMonths: null })
                                  } else {
                                    setFormData({ ...formData, retainerDurationMonths: parseInt(value) || null })
                                  }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                required
                              >
                                <option value="">Select duration</option>
                                <option value="1">1 month</option>
                                <option value="2">2 months</option>
                                <option value="3">3 months</option>
                                <option value="4">4 months</option>
                                <option value="5">5 months</option>
                                <option value="6">6 months</option>
                                <option value="7">7 months</option>
                                <option value="8">8 months</option>
                                <option value="9">9 months</option>
                                <option value="10">10 months</option>
                                <option value="11">11 months</option>
                                <option value="12">12 months</option>
                                <option value="CUSTOM">Custom</option>
                              </select>
                              {formData.retainerDurationMonths === null && (
                                <Input
                                  type="number"
                                  min="1"
                                  placeholder="Enter number of months"
                                  onChange={(e) => setFormData({ ...formData, retainerDurationMonths: parseInt(e.target.value) || null })}
                                />
                              )}
                            </div>
                            {formData.retainerStartDate && formData.retainerDurationMonths && (
                              <p className="text-sm text-gray-600">
                                Monthly retainer charged on {new Date(formData.retainerStartDate).toLocaleDateString()} and every anniversary thereafter for {formData.retainerDurationMonths} {formData.retainerDurationMonths === 1 ? "month" : "months"}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="pt-4 border-t">
                          <Label className="text-base font-semibold mb-3 block">Project Scope</Label>
                          <div className="space-y-3">
                            <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                              <input
                                type="radio"
                                name="retainerProjectScope"
                                value="ALL_PROJECTS"
                                checked={formData.retainerProjectScope === "ALL_PROJECTS"}
                                onChange={(e) => setFormData({ ...formData, retainerProjectScope: e.target.value, retainerProjectIds: [] })}
                                className="w-4 h-4"
                              />
                              <div className="flex-1">
                                <div className="font-medium">All client projects</div>
                                <div className="text-sm text-gray-600">Retainer applies to all projects for this client</div>
                              </div>
                            </label>
                            <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                              <input
                                type="radio"
                                name="retainerProjectScope"
                                value="SPECIFIC_PROJECTS"
                                checked={formData.retainerProjectScope === "SPECIFIC_PROJECTS"}
                                onChange={(e) => setFormData({ ...formData, retainerProjectScope: e.target.value })}
                                className="w-4 h-4"
                              />
                              <div className="flex-1">
                                <div className="font-medium">Specific projects</div>
                                <div className="text-sm text-gray-600">Retainer applies only to selected projects</div>
                              </div>
                            </label>
                          </div>
                          {formData.retainerProjectScope === "SPECIFIC_PROJECTS" && (
                            <div className="mt-4 space-y-2">
                              <Label>Select Projects *</Label>
                              {!formData.clientId ? (
                                <p className="text-xs text-gray-500">Please select a client first</p>
                              ) : clientProjects.length === 0 ? (
                                <p className="text-xs text-gray-500">No active projects found for this client</p>
                              ) : (
                                <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-3">
                                  {clientProjects.map((project) => (
                                    <label key={project.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                                      <input
                                        type="checkbox"
                                        checked={formData.retainerProjectIds.includes(project.id)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setFormData({ ...formData, retainerProjectIds: [...formData.retainerProjectIds, project.id] })
                                          } else {
                                            setFormData({ ...formData, retainerProjectIds: formData.retainerProjectIds.filter((id: string) => id !== project.id) })
                                          }
                                        }}
                                        className="h-4 w-4 rounded border-gray-300"
                                      />
                                      <span className="text-sm">{project.name}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {formData.type === "HOURLY" && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Hourly Rate Configuration</CardTitle>
                        <CardDescription>Configure how hourly rates will be determined for this proposal</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="estimatedHours">Estimated Hours</Label>
                            <Input
                              id="estimatedHours"
                              type="number"
                              step="0.25"
                              min="0"
                              value={formData.estimatedHours}
                              onChange={(e) => setFormData({ ...formData, estimatedHours: parseFloat(e.target.value) || 0 })}
                              placeholder="Estimated hours"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="hourlyRateRangeMin">Min Rate ({selectedCurrency.symbol}/hr)</Label>
                            <Input
                              id="hourlyRateRangeMin"
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.hourlyRateRangeMin}
                              onChange={(e) => setFormData({ ...formData, hourlyRateRangeMin: parseFloat(e.target.value) || 0 })}
                              placeholder="Minimum rate"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="hourlyRateRangeMax">Max Rate ({selectedCurrency.symbol}/hr)</Label>
                            <Input
                              id="hourlyRateRangeMax"
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.hourlyRateRangeMax}
                              onChange={(e) => setFormData({ ...formData, hourlyRateRangeMax: parseFloat(e.target.value) || 0 })}
                              placeholder="Maximum rate"
                            />
                          </div>
                        </div>

                        <div className="pt-4 border-t">
                          <Label className="text-base font-semibold mb-3 block">Rate Type</Label>
                          <p className="text-sm text-gray-600 mb-4">How will hourly rates be determined?</p>
                          
                          <div className="space-y-3 mb-4">
                            <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                              <input
                                type="radio"
                                name="hourlyRateTableType"
                                value="FIXED_RATE"
                                checked={formData.hourlyRateTableType === "FIXED_RATE" || !formData.hourlyRateTableType}
                                onChange={(e) => setFormData({ ...formData, hourlyRateTableType: e.target.value })}
                                className="w-4 h-4"
                              />
                              <div className="flex-1">
                                <div className="font-medium">Rate Range (Min/Max)</div>
                                <div className="text-sm text-gray-600">Use the min/max rate range above</div>
                              </div>
                            </label>
                            
                            <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                              <input
                                type="radio"
                                name="hourlyRateTableType"
                                value="HOURLY_TABLE"
                                checked={formData.hourlyRateTableType === "HOURLY_TABLE"}
                                onChange={(e) => setFormData({ ...formData, hourlyRateTableType: e.target.value })}
                                className="w-4 h-4"
                              />
                              <div className="flex-1">
                                <div className="font-medium">Hourly Table</div>
                                <div className="text-sm text-gray-600">Charge different rates based on user profile</div>
                              </div>
                            </label>
                          </div>
                          
                          {formData.hourlyRateTableType === "HOURLY_TABLE" && (
                            <div className="space-y-4">
                              <Label className="text-base font-semibold">Hourly Rates by Profile</Label>
                              <div className="space-y-2">
                                {[
                                  { key: "SECRETARIAT", label: "Secretariat" },
                                  { key: "TRAINEE", label: "Trainee" },
                                  { key: "JUNIOR_LAWYER", label: "Junior Lawyer" },
                                  { key: "LAWYER", label: "Lawyer" },
                                  { key: "SENIOR_LAWYER", label: "Senior Lawyer" },
                                  { key: "PARTNER", label: "Partner" },
                                ].map((profile) => (
                                  <div key={profile.key} className="grid grid-cols-2 gap-4 items-center">
                                    <Label>{profile.label}</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={formData.hourlyRateTableRates?.[profile.key] || 0}
                                      onChange={(e) => {
                                        const newRates = { ...(formData.hourlyRateTableRates || {}), [profile.key]: parseFloat(e.target.value) || 0 }
                                        setFormData({ ...formData, hourlyRateTableRates: newRates })
                                      }}
                                      placeholder={`${selectedCurrency.symbol}/hr`}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Blended Rate Option - Only for HOURLY or MIXED_MODEL (not for FIXED_FEE) */}
                  {formData.type && formData.type !== "FIXED_FEE" && (formData.type === "HOURLY" || formData.type === "MIXED_MODEL") && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Blended Rate Option</CardTitle>
                        <CardDescription>Apply a single rate to all line items regardless of individual professional rates</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="useBlendedRate"
                            checked={formData.useBlendedRate}
                            onChange={(e) => setFormData({ ...formData, useBlendedRate: e.target.checked })}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <Label htmlFor="useBlendedRate" className="cursor-pointer">
                            Use blended rate for all line items
                          </Label>
                        </div>
                        {formData.useBlendedRate && (
                          <div className="space-y-2">
                            <Label htmlFor="blendedRate">Blended Rate ({selectedCurrency.symbol}/hr)</Label>
                            <Input
                              id="blendedRate"
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.blendedRate}
                              onChange={(e) => setFormData({ ...formData, blendedRate: parseFloat(e.target.value) || 0 })}
                              placeholder="Enter blended hourly rate"
                            />
                            <p className="text-xs text-gray-500">This rate will be applied to all line items when enabled</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {formData.type === "SUCCESS_FEE" && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Success Fee Configuration</CardTitle>
                        <CardDescription>Configure the base fee and success fee structure</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-4">
                          <Label className="text-base font-semibold">Base Fee Type</Label>
                          <div className="space-y-3">
                            <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                              <input
                                type="radio"
                                name="successFeeBaseType"
                                value="FIXED_AMOUNT"
                                checked={formData.successFeeBaseType === "FIXED_AMOUNT"}
                                onChange={(e) => {
                                  setFormData({ 
                                    ...formData, 
                                    successFeeBaseType: e.target.value,
                                    successFeeBaseAmount: formData.successFeeBaseAmount || 0,
                                    successFeeBaseHourlyRate: 0,
                                    successFeeBaseHourlyDescription: "",
                                  })
                                }}
                                className="w-4 h-4"
                              />
                              <div className="flex-1">
                                <div className="font-medium">Fixed Amount</div>
                                <div className="text-sm text-gray-600">Charge a fixed base fee</div>
                              </div>
                            </label>
                            
                            <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                              <input
                                type="radio"
                                name="successFeeBaseType"
                                value="HOURLY_RATE"
                                checked={formData.successFeeBaseType === "HOURLY_RATE"}
                                onChange={(e) => {
                                  setFormData({ 
                                    ...formData, 
                                    successFeeBaseType: e.target.value,
                                    successFeeBaseAmount: 0,
                                    successFeeBaseHourlyRate: formData.successFeeBaseHourlyRate || 0,
                                    successFeeBaseHourlyDescription: formData.successFeeBaseHourlyDescription || "",
                                  })
                                }}
                                className="w-4 h-4"
                              />
                              <div className="flex-1">
                                <div className="font-medium">Hourly Rate</div>
                                <div className="text-sm text-gray-600">Charge an hourly rate as base fee</div>
                              </div>
                            </label>
                          </div>
                          
                          {formData.successFeeBaseType === "FIXED_AMOUNT" && (
                            <div className="space-y-2">
                              <Label htmlFor="successFeeBaseAmount">Base Fee Amount ({selectedCurrency.symbol}) *</Label>
                              <Input
                                id="successFeeBaseAmount"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.successFeeBaseAmount || 0}
                                onChange={(e) => setFormData({ ...formData, successFeeBaseAmount: parseFloat(e.target.value) || 0 })}
                                required
                              />
                            </div>
                          )}
                          
                          {formData.successFeeBaseType === "HOURLY_RATE" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="successFeeBaseHourlyRate">Hourly Rate ({selectedCurrency.symbol}/hr) *</Label>
                                <Input
                                  id="successFeeBaseHourlyRate"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={formData.successFeeBaseHourlyRate || 0}
                                  onChange={(e) => setFormData({ ...formData, successFeeBaseHourlyRate: parseFloat(e.target.value) || 0 })}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="successFeeBaseHourlyDescription">Description *</Label>
                                <Input
                                  id="successFeeBaseHourlyDescription"
                                  type="text"
                                  value={formData.successFeeBaseHourlyDescription || ""}
                                  onChange={(e) => setFormData({ ...formData, successFeeBaseHourlyDescription: e.target.value })}
                                  placeholder="e.g., Legal services"
                                  required
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="pt-4 border-t space-y-4">
                          <Label className="text-base font-semibold">Success Fee Type</Label>
                          <div className="space-y-3">
                            <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                              <input
                                type="radio"
                                name="successFeeType"
                                value="PERCENTAGE"
                                checked={formData.successFeeType === "PERCENTAGE"}
                                onChange={(e) => {
                                  setFormData({ 
                                    ...formData, 
                                    successFeeType: e.target.value,
                                    successFeePercent: formData.successFeePercent || 0,
                                    successFeeAmount: 0,
                                    successFeeValue: formData.successFeeValue || 0,
                                  })
                                }}
                                className="w-4 h-4"
                              />
                              <div className="flex-1">
                                <div className="font-medium">Percentage</div>
                                <div className="text-sm text-gray-600">Success fee as a percentage of transaction value</div>
                              </div>
                            </label>
                            
                            <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                              <input
                                type="radio"
                                name="successFeeType"
                                value="FIXED_AMOUNT"
                                checked={formData.successFeeType === "FIXED_AMOUNT"}
                                onChange={(e) => {
                                  setFormData({ 
                                    ...formData, 
                                    successFeeType: e.target.value,
                                    successFeePercent: 0,
                                    successFeeAmount: formData.successFeeAmount || 0,
                                    successFeeValue: 0,
                                  })
                                }}
                                className="w-4 h-4"
                              />
                              <div className="flex-1">
                                <div className="font-medium">Fixed Amount</div>
                                <div className="text-sm text-gray-600">Success fee as a fixed amount</div>
                              </div>
                            </label>
                          </div>
                          
                          {formData.successFeeType === "PERCENTAGE" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="successFeePercent">Success Fee Percentage (%) *</Label>
                                <Input
                                  id="successFeePercent"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={formData.successFeePercent || 0}
                                  onChange={(e) => setFormData({ ...formData, successFeePercent: parseFloat(e.target.value) || 0 })}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="successFeeValue">Transaction/Deal Value ({selectedCurrency.symbol}) *</Label>
                                <Input
                                  id="successFeeValue"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={formData.successFeeValue || 0}
                                  onChange={(e) => setFormData({ ...formData, successFeeValue: parseFloat(e.target.value) || 0 })}
                                  required
                                />
                              </div>
                            </div>
                          )}
                          
                          {formData.successFeeType === "FIXED_AMOUNT" && (
                            <div className="space-y-2">
                              <Label htmlFor="successFeeAmount">Fixed Success Fee ({selectedCurrency.symbol}) *</Label>
                              <Input
                                id="successFeeAmount"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.successFeeAmount || 0}
                                onChange={(e) => setFormData({ ...formData, successFeeAmount: parseFloat(e.target.value) || 0 })}
                                required
                              />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {formData.type === "MIXED_MODEL" && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Mixed Model Configuration</CardTitle>
                        <CardDescription>Select which billing methods to include in this mixed model proposal</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Select Billing Methods</Label>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <label className="flex items-center space-x-2 cursor-pointer p-2 border rounded hover:bg-gray-50">
                              <input
                                type="checkbox"
                                checked={formData.mixedModelMethods.includes("FIXED_FEE")}
                                onChange={(e) => {
                                  const methods = e.target.checked
                                    ? [...formData.mixedModelMethods, "FIXED_FEE"]
                                    : formData.mixedModelMethods.filter((m: string) => m !== "FIXED_FEE")
                                  setFormData({ ...formData, mixedModelMethods: methods })
                                }}
                                className="rounded"
                              />
                              <span>Fixed Fee</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer p-2 border rounded hover:bg-gray-50">
                              <input
                                type="checkbox"
                                checked={formData.mixedModelMethods.includes("HOURLY")}
                                onChange={(e) => {
                                  const methods = e.target.checked
                                    ? [...formData.mixedModelMethods, "HOURLY"]
                                    : formData.mixedModelMethods.filter((m: string) => m !== "HOURLY")
                                  setFormData({ ...formData, mixedModelMethods: methods })
                                }}
                                className="rounded"
                              />
                              <span>Hourly</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer p-2 border rounded hover:bg-gray-50">
                              <input
                                type="checkbox"
                                checked={formData.mixedModelMethods.includes("RETAINER")}
                                onChange={(e) => {
                                  const methods = e.target.checked
                                    ? [...formData.mixedModelMethods, "RETAINER"]
                                    : formData.mixedModelMethods.filter((m: string) => m !== "RETAINER")
                                  setFormData({ ...formData, mixedModelMethods: methods })
                                }}
                                className="rounded"
                              />
                              <span>Retainer</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer p-2 border rounded hover:bg-gray-50">
                              <input
                                type="checkbox"
                                checked={formData.mixedModelMethods.includes("SUCCESS_FEE")}
                                onChange={(e) => {
                                  const methods = e.target.checked
                                    ? [...formData.mixedModelMethods, "SUCCESS_FEE"]
                                    : formData.mixedModelMethods.filter((m: string) => m !== "SUCCESS_FEE")
                                  setFormData({ ...formData, mixedModelMethods: methods })
                                }}
                                className="rounded"
                              />
                              <span>Success Fee</span>
                            </label>
                          </div>
                        </div>

                        {/* Show full configuration panels for selected methods */}
                        <div className="space-y-4 pt-4 border-t">
                          {formData.mixedModelMethods.includes("FIXED_FEE") && (
                            <FixedFeeConfig
                              formData={formData}
                              setFormData={setFormData}
                              selectedCurrency={selectedCurrency}
                              clientProjects={clientProjects}
                              clientId={formData.clientId}
                            />
                          )}

                          {formData.mixedModelMethods.includes("HOURLY") && (
                            <HourlyConfig
                              formData={formData}
                              setFormData={setFormData}
                              selectedCurrency={selectedCurrency}
                              clientProjects={clientProjects}
                              clientId={formData.clientId}
                            />
                          )}

                          {formData.mixedModelMethods.includes("RETAINER") && (
                            <RetainerConfig
                              formData={formData}
                              setFormData={setFormData}
                              selectedCurrency={selectedCurrency}
                              clientProjects={clientProjects}
                              clientId={formData.clientId}
                            />
                          )}

                          {formData.mixedModelMethods.includes("SUCCESS_FEE") && (
                            <SuccessFeeConfig
                              formData={formData}
                              setFormData={setFormData}
                              selectedCurrency={selectedCurrency}
                              clientProjects={clientProjects}
                              clientId={formData.clientId}
                            />
                          )}
                        </div>

                        {formData.mixedModelMethods.length === 0 && (
                          <p className="text-sm text-gray-500 text-center py-4">
                            Select at least one billing method above
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {wizardSteps[currentWizardStep]?.id === "payment" && (
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Configure Payment Terms</CardTitle>
              <CardDescription>
                {formData.type === "RETAINER" 
                  ? "Configure retainer balance and unused hours policy"
                  : "Define when and how payments will be made"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.type === "RETAINER" ? (
                <RetainerPaymentTerms
                  currency={formData.currency}
                  retainerUnusedBalancePolicy={formData.retainerUnusedBalancePolicy}
                  retainerUnusedBalanceExpiryMonths={formData.retainerUnusedBalanceExpiryMonths}
                  onUnusedBalancePolicyChange={(policy) => setFormData({ ...formData, retainerUnusedBalancePolicy: policy })}
                  onUnusedBalanceExpiryMonthsChange={(months) => setFormData({ ...formData, retainerUnusedBalanceExpiryMonths: months })}
                />
              ) : (
                <PaymentTermsWizard
                  currency={formData.currency}
                  milestones={milestones.map((m, index) => ({ id: m.id || `temp-${index}`, name: m.name }))}
                  proposalLevel={proposalPaymentTerm}
                  onProposalLevelChange={(term) => setProposalPaymentTerm(term)}
                />
              )}
              {errors.paymentTerms && (
                <p className="text-sm text-destructive mt-2">{errors.paymentTerms}</p>
              )}
            </CardContent>
          </Card>
        )}

        {wizardSteps[currentWizardStep]?.id === "milestones" && shouldShowMilestonesStep && (
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Define Milestones (Optional)</CardTitle>
              <CardDescription>Create milestones for milestone-based payments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2 p-4 border rounded">
                <input
                  type="checkbox"
                  id="useMilestones"
                  checked={formData.useMilestones}
                  onChange={(e) => {
                    setFormData({ ...formData, useMilestones: e.target.checked })
                    if (!e.target.checked) {
                      setMilestones([])
                      setItems(items.map(item => ({ ...item, milestoneIds: [] })))
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="useMilestones" className="cursor-pointer font-semibold">
                  Enable milestone payments
                </Label>
              </div>

              {formData.useMilestones && (
                <div className="space-y-4 p-4 border rounded bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">Define Milestones</h3>
                      <p className="text-sm text-gray-500">Create milestones that can be assigned to line items</p>
                    </div>
                    <Button type="button" onClick={addMilestone} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Milestone
                    </Button>
                  </div>
                  {milestones.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No milestones defined. Add at least one milestone to assign to line items.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {milestones.map((milestone, index) => (
                        <Card key={milestone.id || index}>
                          <CardContent className="pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>Milestone Name *</Label>
                                <Input
                                  value={milestone.name}
                                  onChange={(e) => updateMilestone(index, "name", e.target.value)}
                                  required
                                  placeholder="e.g., Milestone A, 50% Upfront"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Due Date</Label>
                                <Input
                                  type="date"
                                  value={milestone.dueDate || ""}
                                  onChange={(e) => updateMilestone(index, "dueDate", e.target.value)}
                                />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <Label>Description</Label>
                                <Textarea
                                  value={milestone.description || ""}
                                  onChange={(e) => updateMilestone(index, "description", e.target.value)}
                                  rows={2}
                                  placeholder="Optional description"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Amount ({selectedCurrency.symbol})</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={milestone.amount || ""}
                                  onChange={(e) => updateMilestone(index, "amount", parseFloat(e.target.value) || undefined)}
                                  placeholder="Fixed amount (optional)"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Percentage (%)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={milestone.percent || ""}
                                  onChange={(e) => updateMilestone(index, "percent", parseFloat(e.target.value) || undefined)}
                                  placeholder="Percentage (optional)"
                                />
                              </div>
                            </div>
                            <div className="mt-3 flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeMilestone(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                  {errors.milestones && (
                    <p className="text-sm text-destructive mt-2">{String(errors.milestones)}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {wizardSteps[currentWizardStep]?.id === "items" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Step {wizardSteps.findIndex(s => s.id === "items") + 1}: Configure Line Items</CardTitle>
                  <CardDescription>Add line items for this proposal</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button type="button" onClick={addItem} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Line Item
                  </Button>
                  {formData.clientId && (
                    <AddExpenseButton
                      clientId={formData.clientId}
                      currency={formData.currency}
                      onExpenseAdded={(expense: any) => {
                        const newItem: LineItem = {
                          description: expense.description,
                          amount: expense.amount,
                          // Only set expenseId if it's a real project expense (not a direct/estimated expense)
                          expenseId: expense.id && !expense.id.startsWith("direct-") ? expense.id : undefined,
                          billingMethod: "FIXED_FEE", // Expenses are typically fixed fee
                          // Set isEstimated flag for direct/estimated expenses (when no real expenseId)
                          isEstimated: !expense.id || expense.id.startsWith("direct-") ? (expense.isEstimated || false) : false,
                        }
                        setItems([...items, newItem])
                      }}
                    />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Show milestone assignment section if milestones are enabled and defined */}
              {formData.useMilestones && milestones.length > 0 && (
                <div className="p-4 border rounded bg-blue-50">
                  <p className="text-sm text-gray-700 mb-3">
                    <strong>Note:</strong> You can assign milestones to line items below. Milestones are defined in Step 3.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {milestones.map((milestone) => (
                      <span
                        key={milestone.id || milestone.name}
                        className="px-3 py-1 rounded-full text-sm bg-white border border-blue-200"
                      >
                        {milestone.name}
                        {milestone.percent && ` (${milestone.percent}%)`}
                        {milestone.amount && !milestone.percent && ` (${selectedCurrency.symbol}${milestone.amount})`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {items.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No items added yet. Click &quot;Add Line Item&quot; to get started.
              </p>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => (
                  <Card key={index}>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Billing Method Selector - Show for MIXED_MODEL or always allow per-item billing */}
                        {(formData.type === "MIXED_MODEL" || formData.type === "FIXED_FEE" || formData.type === "SUCCESS_FEE" || formData.type === "HOURLY" || formData.type === "CAPPED_FEE") && (
                          <div className="space-y-2">
                            <Label>Billing Method</Label>
                            <Select
                              value={item.billingMethod || ""}
                              onChange={(e) => {
                                const newBillingMethod = e.target.value || undefined
                                const updatedItem = { ...items[index] }
                                updatedItem.billingMethod = newBillingMethod
                                const newItems = [...items]
                                newItems[index] = updatedItem
                                setItems(newItems)
                              }}
                            >
                              <option value="">Select method</option>
                              {formData.type === "MIXED_MODEL" ? (
                                <>
                                  <option value="FIXED_FEE">Fixed Fee</option>
                                  <option value="SUCCESS_FEE">Success Fee</option>
                                  <option value="HOURLY">Hourly</option>
                                  <option value="CAPPED_FEE">Capped Fee</option>
                                </>
                              ) : (
                                <option value={formData.type}>{formData.type.replace("_", " ")}</option>
                              )}
                            </Select>
                          </div>
                        )}

                        <div className={`space-y-2 ${(formData.type === "MIXED_MODEL" || formData.type === "FIXED_FEE" || formData.type === "SUCCESS_FEE" || formData.type === "HOURLY" || formData.type === "CAPPED_FEE") ? "md:col-span-2 lg:col-span-2" : "md:col-span-2"}`}>
                          <div className="flex items-center gap-2">
                            <Label>Description *</Label>
                            {item.expenseId && (
                              <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-800">
                                Expense
                              </span>
                            )}
                            {item.isEstimated && (
                              <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800">
                                Estimated
                              </span>
                            )}
                            {!item.expenseId && !item.isEstimated && item.billingMethod === "FIXED_FEE" && (
                              <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                                Accurate
                              </span>
                            )}
                          </div>
                          <Input
                            value={item.description}
                            onChange={(e) => updateItem(index, "description", e.target.value)}
                            required
                            placeholder="e.g., Opening a bank account"
                            disabled={!!item.expenseId}
                            className={item.expenseId ? "bg-gray-50" : ""}
                          />
                          {item.expenseId && (
                            <p className="text-xs text-gray-500">Linked to project expense (read-only)</p>
                          )}
                        </div>

                        {/* For HOURLY proposals, show person selector, quantity (hours) and rate fields */}
                        {(formData.type === "HOURLY" || item.billingMethod === "HOURLY") ? (
                          <>
                            {users.length > 0 && (
                              <div className="space-y-2">
                                <Label>Person (Optional)</Label>
                                <Select
                                  value={item.personId || ""}
                                  onChange={(e) => updateItem(index, "personId", e.target.value || undefined)}
                                >
                                  <option value="">Select person</option>
                                  {users.map((user) => (
                                    <option key={user.id} value={user.id}>
                                      {user.name} {user.defaultHourlyRate ? `(${formatCurrency(user.defaultHourlyRate)}/hr)` : ""}
                                    </option>
                                  ))}
                                </Select>
                                <p className="text-xs text-gray-500">
                                  Selecting a person will auto-fill their default hourly rate
                                </p>
                              </div>
                            )}
                            <div className="space-y-2">
                              <Label>Estimated Hours *</Label>
                              <Input
                                type="number"
                                step="0.25"
                                min="0"
                                value={item.quantity || ""}
                                onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                                required
                                placeholder="e.g., 5"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Hourly Rate ({selectedCurrency.symbol}) *</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.rate || ""}
                                onChange={(e) => updateItem(index, "rate", parseFloat(e.target.value) || 0)}
                                required
                                placeholder="e.g., 180"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Total Amount ({selectedCurrency.symbol})</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.amount || ""}
                                onChange={(e) => updateItem(index, "amount", parseFloat(e.target.value) || 0)}
                                readOnly
                                className="bg-gray-50 cursor-not-allowed"
                                required
                              />
                              <p className="text-xs text-gray-500">
                                Auto-calculated: {item.quantity || 0} hours × {formatCurrency(item.rate || 0)} = {formatCurrency(item.amount || 0)}
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* For Fixed Fee items, show quantity and unit price */}
                            {formData.type === "FIXED_FEE" && (
                              <>
                                <div className="space-y-2 md:col-span-1">
                                  <Label>Quantity *</Label>
                                  <Input
                                    type="number"
                                    step="1"
                                    min="1"
                                    value={item.quantity || 1}
                                    onChange={(e) => {
                                      const quantity = parseFloat(e.target.value) || 1
                                      updateItem(index, "quantity", quantity)
                                      // Auto-calculation happens in updateItem function
                                    }}
                                    required
                                    placeholder="e.g., 1"
                                  />
                                </div>
                                <div className="space-y-2 md:col-span-1">
                                  <Label>Price per Item ({selectedCurrency.symbol}) *</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.unitPrice || ""}
                                    onChange={(e) => {
                                      const unitPrice = parseFloat(e.target.value) || 0
                                      updateItem(index, "unitPrice", unitPrice)
                                      // Auto-calculation happens in updateItem function
                                    }}
                                    required
                                    placeholder="0.00"
                                  />
                                </div>
                                <div className="space-y-2 md:col-span-1">
                                  <Label>Total Amount ({selectedCurrency.symbol})</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={item.amount || ""}
                                    onChange={(e) => updateItem(index, "amount", parseFloat(e.target.value) || 0)}
                                    readOnly
                                    className="bg-gray-50 cursor-not-allowed"
                                    required
                                  />
                                  <p className="text-xs text-gray-500">
                                    Auto-calculated: {item.quantity || 1} × {formatCurrency(item.unitPrice || 0)} = {formatCurrency(item.amount || 0)}
                                  </p>
                                </div>
                              </>
                            )}
                            
                            {/* For non-Fixed Fee items, show direct amount input */}
                            {formData.type !== "FIXED_FEE" && (
                              <div className="space-y-2 md:col-span-1">
                                <Label>Amount ({selectedCurrency.symbol}) *</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.amount || ""}
                                  onChange={(e) => updateItem(index, "amount", parseFloat(e.target.value) || 0)}
                                  required
                                  placeholder="0.00"
                                />
                              </div>
                            )}
                            
                            {/* Discount fields for Fixed Fee and other non-hourly items - isolated (no auto-calculation) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2">
                              <div className="space-y-2">
                                <Label>Discount Percentage (%) (Optional)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={item.discountPercent || ""}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    const discountPercent = value === "" ? undefined : (parseFloat(value) || undefined)
                                    // Only update discountPercent, don't auto-calculate amount
                                    const updated = [...items]
                                    updated[index] = {
                                      ...updated[index],
                                      discountPercent,
                                      // Clear discountAmount when setting percentage
                                      discountAmount: discountPercent !== undefined ? undefined : updated[index].discountAmount,
                                    }
                                    setItems(updated)
                                  }}
                                  placeholder="e.g., 10"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Discount Amount ({selectedCurrency.symbol}) (Optional)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.discountAmount || ""}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    const discountAmount = value === "" ? undefined : (parseFloat(value) || undefined)
                                    // Only update discountAmount, don't auto-calculate percentage
                                    const updated = [...items]
                                    updated[index] = {
                                      ...updated[index],
                                      discountAmount,
                                      // Clear discountPercent when setting amount
                                      discountPercent: discountAmount !== undefined ? undefined : updated[index].discountPercent,
                                    }
                                    setItems(updated)
                                  }}
                                  placeholder="e.g., 100"
                                />
                              </div>
                            </div>
                            {(item.discountPercent || item.discountAmount) && (
                              <div className="text-sm text-gray-600">
                                Discount: {item.discountPercent ? `${item.discountPercent}%` : ""} {item.discountAmount ? `(${selectedCurrency.symbol}${item.discountAmount.toFixed(2)})` : ""}
                                {item.amount && item.discountAmount && (
                                  <span className="ml-2">Final: {selectedCurrency.symbol}{(item.amount - item.discountAmount).toFixed(2)}</span>
                                )}
                              </div>
                            )}
                          </>
                        )}

                        {/* Estimate and Capped Options for All Items (except expenses) */}
                        {!item.expenseId && (
                          <div className="space-y-3 md:col-span-2">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`isEstimate-${index}`}
                                checked={item.isEstimate || false}
                                onChange={(e) => updateItem(index, "isEstimate", e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                              <Label htmlFor={`isEstimate-${index}`} className="cursor-pointer">
                                Mark as Estimate
                              </Label>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`isCapped-${index}`}
                                checked={item.isCapped || false}
                                onChange={(e) => {
                                  updateItem(index, "isCapped", e.target.checked)
                                  if (!e.target.checked) {
                                    updateItem(index, "cappedHours", undefined)
                                    updateItem(index, "cappedAmount", undefined)
                                  }
                                }}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                              <Label htmlFor={`isCapped-${index}`} className="cursor-pointer">
                                Apply Cap
                              </Label>
                            </div>
                            
                            {item.isCapped && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                                <div className="space-y-2">
                                  <Label>Capped Hours (Optional - for hourly items only)</Label>
                                  <Input
                                    type="number"
                                    step="0.25"
                                    min="0"
                                    value={item.cappedHours || ""}
                                    onChange={(e) => updateItem(index, "cappedHours", parseFloat(e.target.value) || undefined)}
                                    placeholder="e.g., 100"
                                    disabled={item.billingMethod !== "HOURLY" && formData.type !== "HOURLY"}
                                    className={item.billingMethod !== "HOURLY" && formData.type !== "HOURLY" ? "bg-gray-50 cursor-not-allowed" : ""}
                                  />
                                  {(item.billingMethod !== "HOURLY" && formData.type !== "HOURLY") && (
                                    <p className="text-xs text-gray-500">Only available for hourly items</p>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <Label>Capped Amount ({selectedCurrency.symbol}) (Optional)</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.cappedAmount || ""}
                                    onChange={(e) => updateItem(index, "cappedAmount", parseFloat(e.target.value) || undefined)}
                                    placeholder="e.g., 10000"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Milestone Assignment - Only show when milestones are enabled */}
                        {formData.useMilestones && milestones.length > 0 && (
                          <div className="space-y-2 md:col-span-2 lg:col-span-4">
                            <Label>Assign Milestones</Label>
                            <div className="flex flex-wrap gap-2 p-3 border rounded bg-gray-50">
                              {milestones.map((milestone) => {
                                const isSelected = item.milestoneIds?.includes(milestone.id || "") || false
                                return (
                                  <label
                                    key={milestone.id || milestone.name}
                                    className="flex items-center space-x-2 cursor-pointer px-3 py-1.5 border rounded hover:bg-white transition-colors"
                                    style={{
                                      backgroundColor: isSelected ? "#3B82F6" : "white",
                                      color: isSelected ? "white" : "#374151",
                                      borderColor: isSelected ? "#3B82F6" : "#D1D5DB",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        const currentIds = item.milestoneIds || []
                                        if (e.target.checked) {
                                          updateItemMilestones(index, [...currentIds, milestone.id || ""])
                                        } else {
                                          updateItemMilestones(index, currentIds.filter(id => id !== milestone.id))
                                        }
                                      }}
                                      className="rounded"
                                    />
                                    <span className="text-sm font-medium">
                                      {milestone.name}
                                      {milestone.percent && ` (${milestone.percent}%)`}
                                      {milestone.amount && !milestone.percent && ` (${selectedCurrency.symbol}${milestone.amount})`}
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                            {item.milestoneIds && item.milestoneIds.length > 0 && (
                              <p className="text-xs text-gray-500 mt-1">
                                {item.milestoneIds.length} milestone{item.milestoneIds.length !== 1 ? "s" : ""} assigned
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {errors.items && (
              <p className="text-sm text-destructive mt-2">{String(errors.items)}</p>
            )}

              {/* Summary Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-semibold">{selectedCurrency.symbol}{calculateSubtotal().toFixed(2)}</span>
                    </div>
                    {calculateClientDiscount() > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Client Discount:</span>
                        <span>-{selectedCurrency.symbol}{calculateClientDiscount().toFixed(2)}</span>
                      </div>
                    )}
                    {calculateTax() > 0 && (
                      <div className="flex justify-between">
                        <span>Tax ({formData.taxRate}%):</span>
                        <span>{selectedCurrency.symbol}{calculateTax().toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-2 border-t">
                      <span>Grand Total:</span>
                      <span>{selectedCurrency.symbol}{calculateGrandTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        )}

        {wizardSteps[currentWizardStep]?.id === "review" && (
          <Card>
            <CardHeader>
              <CardTitle>Step {wizardSteps.length}: Review & Submit</CardTitle>
              <CardDescription>Review all proposal details before submitting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Proposal Information Summary */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Proposal Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Client/Lead:</span>
                    <span className="ml-2 font-medium">
                      {formData.clientId ? clients.find(c => c.id === formData.clientId)?.name || "N/A" : 
                       formData.leadId ? leads.find(l => l.id === formData.leadId)?.name || "N/A" : 
                       "Not selected"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Title:</span>
                    <span className="ml-2 font-medium">{formData.title || "Not set"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Billing Method:</span>
                    <span className="ml-2 font-medium">{formData.type || "Not selected"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Currency:</span>
                    <span className="ml-2 font-medium">{formData.currency}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Issue Date:</span>
                    <span className="ml-2 font-medium">{formData.issueDate || "Not set"}</span>
                  </div>
                  {formData.expiryDate && (
                    <div>
                      <span className="text-gray-500">Expiry Date:</span>
                      <span className="ml-2 font-medium">{formData.expiryDate}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Retainer Configuration Summary */}
              {formData.type === "RETAINER" && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Retainer Configuration</h3>
                  <div className="text-sm space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-gray-500">Monthly Retainer:</span>
                        <span className="ml-2 font-medium">
                          {selectedCurrency.symbol}{formData.retainerMonthlyAmount.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Hours Included:</span>
                        <span className="ml-2 font-medium">{formData.retainerHoursPerMonth} hours/month</span>
                      </div>
                    </div>
                    {formData.retainerStartDate && formData.retainerDurationMonths && (
                      <div>
                        <span className="text-gray-500">Billing Period:</span>
                        <span className="ml-2 font-medium">
                          Monthly retainer charged on {new Date(formData.retainerStartDate).toLocaleDateString()} and every anniversary thereafter for {formData.retainerDurationMonths} months
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Project Scope:</span>
                      <span className="ml-2 font-medium">
                        {formData.retainerProjectScope === "ALL_PROJECTS" ? "All client projects" : "Specific projects"}
                      </span>
                      {formData.retainerProjectScope === "SPECIFIC_PROJECTS" && formData.retainerProjectIds.length > 0 && (
                        <div className="mt-1 ml-4 text-xs text-gray-600">
                          Selected: {formData.retainerProjectIds.map((id: string) => clientProjects.find(p => p.id === id)?.name).filter(Boolean).join(", ")}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500">Additional Hours:</span>
                      <span className="ml-2 font-medium">
                        {formData.retainerAdditionalHoursType === "FIXED_RATE" && `${selectedCurrency.symbol}${formData.retainerAdditionalHoursRate}/hr`}
                        {formData.retainerAdditionalHoursType === "RATE_RANGE" && `${selectedCurrency.symbol}${formData.retainerAdditionalHoursRateMin}-${formData.retainerAdditionalHoursRateMax}/hr`}
                        {formData.retainerAdditionalHoursType === "HOURLY_TABLE" && "Hourly table by profile"}
                      </span>
                    </div>
                    {formData.retainerAdditionalHoursType === "HOURLY_TABLE" && formData.retainerHourlyTableRates && (
                      <div className="ml-4 space-y-1">
                        {Object.entries(formData.retainerHourlyTableRates)
                          .filter(([_, rate]: [string, any]) => rate && rate > 0)
                          .sort((a: [string, any], b: [string, any]) => ((a[1] as number) || 0) - ((b[1] as number) || 0))
                          .map(([profile, rate]: [string, any]) => (
                            <div key={profile}>
                              <span className="text-gray-500">{profile.replace(/_/g, " ")}:</span>
                              <span className="ml-2 font-medium">{selectedCurrency.symbol}{rate}/hr</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Retainer Payment Terms Summary */}
              {formData.type === "RETAINER" && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Retainer Payment Terms</h3>
                  <div className="text-sm space-y-2">
                    <div>
                      <span className="text-gray-500">Unused Balance Policy:</span>
                      <span className="ml-2 font-medium">
                        {formData.retainerUnusedBalancePolicy === "EXPIRE" && "Expires at the end of the month"}
                        {formData.retainerUnusedBalancePolicy === "ROLLOVER" && (
                          <>
                            Rolls over to {formData.retainerUnusedBalanceExpiryMonths} {formData.retainerUnusedBalanceExpiryMonths === 1 ? "month" : "months"}
                          </>
                        )}
                      </span>
                    </div>
                    <div className="bg-blue-50 p-3 rounded text-xs text-blue-900">
                      <strong>Note:</strong> If approved, retainer hours will be available in drawdown mode and automatically offset against billed hours in timesheet or project mode.
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Terms Summary */}
              {proposalPaymentTerm && formData.type !== "RETAINER" && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Payment Terms</h3>
                  <div className="text-sm space-y-1">
                    {proposalPaymentTerm.upfrontType && proposalPaymentTerm.upfrontValue !== null && (
                      <p>
                        <span className="text-gray-500">Upfront Payment:</span>{" "}
                        <span className="font-medium">
                          {proposalPaymentTerm.upfrontType === "PERCENT" 
                            ? `${proposalPaymentTerm.upfrontValue}%`
                            : `${selectedCurrency.symbol}${proposalPaymentTerm.upfrontValue}`}
                        </span>
                      </p>
                    )}
                    {/* Only show recurring if explicitly enabled and not FIXED_FEE */}
                    {proposalPaymentTerm.recurringEnabled === true && proposalPaymentTerm.recurringFrequency && formData.type !== "FIXED_FEE" && (
                      <p>
                        <span className="text-gray-500">Recurring:</span>{" "}
                        <span className="font-medium">{proposalPaymentTerm.recurringFrequency}</span>
                      </p>
                    )}
                    {proposalPaymentTerm.installmentType && proposalPaymentTerm.installmentCount && (
                      <p>
                        <span className="text-gray-500">Installments:</span>{" "}
                        <span className="font-medium">
                          {proposalPaymentTerm.installmentCount} payments ({proposalPaymentTerm.installmentType})
                        </span>
                      </p>
                    )}
                    {/* Show ONE_TIME payment details - only if no upfront, no installments, and recurring is explicitly false or null */}
                    {!proposalPaymentTerm.upfrontType && 
                     !proposalPaymentTerm.installmentType && 
                     (proposalPaymentTerm.recurringEnabled === false || proposalPaymentTerm.recurringEnabled === null || proposalPaymentTerm.recurringEnabled === undefined) && (
                      <p>
                        <span className="text-gray-500">Payment Terms:</span>{" "}
                        <span className="font-medium">
                          {proposalPaymentTerm.balanceDueDate
                            ? `Due on ${new Date(proposalPaymentTerm.balanceDueDate).toLocaleDateString()}`
                            : "Paid on completion"}
                        </span>
                      </p>
                    )}
                    {/* Show balance payment only for UPFRONT_BALANCE structure */}
                    {proposalPaymentTerm.upfrontType && proposalPaymentTerm.balancePaymentType && (
                      <p>
                        <span className="text-gray-500">Balance Payment:</span>{" "}
                        <span className="font-medium">
                          {proposalPaymentTerm.balancePaymentType === "TIME_BASED" && proposalPaymentTerm.balanceDueDate
                            ? `Due on ${new Date(proposalPaymentTerm.balanceDueDate).toLocaleDateString()}`
                            : proposalPaymentTerm.balancePaymentType === "MILESTONE_BASED"
                            ? "Milestone-based"
                            : proposalPaymentTerm.balancePaymentType === "FULL_UPFRONT"
                            ? "Full upfront (100%)"
                            : proposalPaymentTerm.balancePaymentType}
                        </span>
                      </p>
                    )}
                    {/* Only show recurring if explicitly enabled */}
                    {proposalPaymentTerm.recurringEnabled === true && proposalPaymentTerm.recurringFrequency && (
                      <p>
                        <span className="text-gray-500">Recurring:</span>{" "}
                        <span className="font-medium">{proposalPaymentTerm.recurringFrequency}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Milestones Summary */}
              {shouldShowMilestonesStep && milestones.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Milestones ({milestones.length})</h3>
                  <div className="space-y-2">
                    {milestones.map((milestone, index) => (
                      <div key={index} className="text-sm p-2 border rounded">
                        <span className="font-medium">{milestone.name}</span>
                        {milestone.amount && <span className="ml-2 text-gray-500">- {selectedCurrency.symbol}{milestone.amount}</span>}
                        {milestone.percent && <span className="ml-2 text-gray-500">- {milestone.percent}%</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Services Summary */}
              {servicesItems.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Services ({servicesItems.length})</h3>
                  <div className="space-y-2">
                    {servicesItems.map((item, index) => {
                      const itemAmount = item.amount || 0
                      const itemDiscount = item.discountAmount || (item.discountPercent && itemAmount ? (itemAmount * item.discountPercent / 100) : 0) || 0
                      const finalAmount = itemAmount - itemDiscount
                      const isHourly = formData.type === "HOURLY" || item.billingMethod === "HOURLY"
                      return (
                        <div key={index} className="text-sm p-2 border rounded">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <span className="font-medium">{item.description || `Item ${index + 1}`}</span>
                              {/* Show estimate and capped info for all items */}
                              {(item.isEstimate || item.isEstimated || item.isCapped) && (
                                <div className="mt-1 space-y-1">
                                  {(item.isEstimate || item.isEstimated) && (
                                    <div className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded inline-block">
                                      {item.isEstimated 
                                        ? `Estimated expense: ${selectedCurrency.symbol}${itemAmount.toFixed(2)}`
                                        : isHourly
                                          ? `Estimated: ${item.quantity || 0} hours at ${selectedCurrency.symbol}${item.rate?.toFixed(2) || "0.00"}/hr = ${selectedCurrency.symbol}${itemAmount.toFixed(2)}`
                                          : `Estimated: ${selectedCurrency.symbol}${itemAmount.toFixed(2)}`}
                                    </div>
                                  )}
                                  {item.isCapped && item.cappedHours && (
                                    <div className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded inline-block ml-2">
                                      Capped at {item.cappedHours} hours at ${selectedCurrency.symbol}${item.rate?.toFixed(2) || "0.00"}/hr = ${selectedCurrency.symbol}${(item.cappedHours * (item.rate || 0)).toFixed(2)}
                                    </div>
                                  )}
                                  {item.isCapped && item.cappedAmount && (
                                    <div className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded inline-block ml-2">
                                      Capped at ${selectedCurrency.symbol}${item.cappedAmount.toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="ml-2 text-gray-500">
                              {itemDiscount > 0 ? (
                                <>
                                  <span className="line-through">{selectedCurrency.symbol}{itemAmount.toFixed(2)}</span>
                                  <span className="ml-2">- {selectedCurrency.symbol}{finalAmount.toFixed(2)}</span>
                                  <span className="ml-2 text-green-600">
                                    ({item.discountPercent ? `${item.discountPercent}%` : `${selectedCurrency.symbol}${item.discountAmount?.toFixed(2)}`} discount)
                                  </span>
                                </>
                              ) : (
                                <span>- {selectedCurrency.symbol}{itemAmount.toFixed(2)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Expenses Summary */}
              {expensesItems.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Expenses ({expensesItems.length})</h3>
                  <div className="space-y-2">
                    {expensesItems.map((item, index) => {
                      const itemAmount = item.amount || 0
                      const itemDiscount = item.discountAmount || (item.discountPercent && itemAmount ? (itemAmount * item.discountPercent / 100) : 0) || 0
                      const finalAmount = itemAmount - itemDiscount
                      const isHourly = formData.type === "HOURLY" || item.billingMethod === "HOURLY"
                      return (
                        <div key={index} className="text-sm p-2 border rounded bg-purple-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">Expense</span>
                                <span className="font-medium">{item.description || `Item ${index + 1}`}</span>
                              </div>
                              {/* Show estimate and capped info for all items */}
                              {(item.isEstimate || item.isEstimated || item.isCapped) && (
                                <div className="mt-1 space-y-1">
                                  {(item.isEstimate || item.isEstimated) && (
                                    <div className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded inline-block">
                                      {item.isEstimated 
                                        ? `Estimated expense: ${selectedCurrency.symbol}${itemAmount.toFixed(2)}`
                                        : isHourly
                                          ? `Estimated: ${item.quantity || 0} hours at ${selectedCurrency.symbol}${item.rate?.toFixed(2) || "0.00"}/hr = ${selectedCurrency.symbol}${itemAmount.toFixed(2)}`
                                          : `Estimated: ${selectedCurrency.symbol}${itemAmount.toFixed(2)}`}
                                    </div>
                                  )}
                                  {item.isCapped && item.cappedHours && (
                                    <div className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded inline-block ml-2">
                                      Capped at {item.cappedHours} hours at ${selectedCurrency.symbol}${item.rate?.toFixed(2) || "0.00"}/hr = ${selectedCurrency.symbol}${(item.cappedHours * (item.rate || 0)).toFixed(2)}
                                    </div>
                                  )}
                                  {item.isCapped && item.cappedAmount && (
                                    <div className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded inline-block ml-2">
                                      Capped at ${selectedCurrency.symbol}${item.cappedAmount.toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="ml-2 text-gray-500">
                              {itemDiscount > 0 ? (
                                <>
                                  <span className="line-through">{selectedCurrency.symbol}{itemAmount.toFixed(2)}</span>
                                  <span className="ml-2">- {selectedCurrency.symbol}{finalAmount.toFixed(2)}</span>
                                  <span className="ml-2 text-green-600">
                                    ({item.discountPercent ? `${item.discountPercent}%` : `${selectedCurrency.symbol}${item.discountAmount?.toFixed(2)}`} discount)
                                  </span>
                                </>
                              ) : (
                                <span>- {selectedCurrency.symbol}{itemAmount.toFixed(2)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Financial Summary */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-lg">Financial Summary</h3>
                {formData.type === "RETAINER" ? (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Monthly Retainer Amount:</span>
                      <span className="font-semibold">{selectedCurrency.symbol}{formData.retainerMonthlyAmount.toFixed(2)}</span>
                    </div>
                    {formData.retainerDurationMonths && (
                      <>
                        <div className="flex justify-between">
                          <span>Duration:</span>
                          <span className="font-semibold">{formData.retainerDurationMonths} months</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold pt-2 border-t">
                          <span>Total Retainer Amount:</span>
                          <span>{selectedCurrency.symbol}{(formData.retainerMonthlyAmount * formData.retainerDurationMonths).toFixed(2)}</span>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Services Subtotal */}
                    {calculateServicesSubtotal() > 0 && (
                      <div className="flex justify-between">
                        <span>Services Subtotal:</span>
                        <span className="font-semibold">{selectedCurrency.symbol}{calculateServicesSubtotal().toFixed(2)}</span>
                      </div>
                    )}
                    {/* Expenses Subtotal */}
                    {calculateExpensesSubtotal() > 0 && (
                      <div className="flex justify-between">
                        <span>Expenses Subtotal:</span>
                        <span className="font-semibold">{selectedCurrency.symbol}{calculateExpensesSubtotal().toFixed(2)}</span>
                      </div>
                    )}
                    {calculateClientDiscount() > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Client Discount (on services):</span>
                        <span>-{selectedCurrency.symbol}{calculateClientDiscount().toFixed(2)}</span>
                      </div>
                    )}
                    {calculateTax() > 0 && (
                      <div className="flex justify-between">
                        <span>Tax ({formData.taxRate}%) on services:</span>
                        <span>{selectedCurrency.symbol}{calculateTax().toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-2 border-t">
                      <span>Grand Total:</span>
                      <span>{selectedCurrency.symbol}{calculateGrandTotal().toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button type="submit" disabled={loading || !canProceedToNextStep()}>
                  {loading ? "Saving..." : initialData ? "Update Proposal" : "Create Proposal"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </ProposalFormWizard>
    </form>

      {/* Create Lead Dialog */}
      {showCreateLeadDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Create New Lead</CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCreateLeadDialog(false)
                    setNewLeadData({ name: "", email: "", company: "", phone: "" })
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateLead} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newLeadName">Name *</Label>
                  <Input
                    id="newLeadName"
                    value={newLeadData.name}
                    onChange={(e) => setNewLeadData({ ...newLeadData, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newLeadEmail">Email</Label>
                  <Input
                    id="newLeadEmail"
                    type="email"
                    value={newLeadData.email}
                    onChange={(e) => setNewLeadData({ ...newLeadData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newLeadCompany">Company</Label>
                  <Input
                    id="newLeadCompany"
                    value={newLeadData.company}
                    onChange={(e) => setNewLeadData({ ...newLeadData, company: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newLeadPhone">Phone</Label>
                  <Input
                    id="newLeadPhone"
                    type="tel"
                    value={newLeadData.phone}
                    onChange={(e) => setNewLeadData({ ...newLeadData, phone: e.target.value })}
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateLeadDialog(false)
                      setNewLeadData({ name: "", email: "", company: "", phone: "" })
                    }}
                    disabled={creatingLead}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creatingLead}>
                    {creatingLead ? "Creating..." : "Create Lead"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Client Dialog */}
      {showCreateClientDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Create New Client</CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCreateClientDialog(false)
                    setNewClientData({ name: "", email: "", company: "", contactInfo: "" })
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateClient} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newClientName">Name *</Label>
                  <Input
                    id="newClientName"
                    value={newClientData.name}
                    onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newClientEmail">Email</Label>
                  <Input
                    id="newClientEmail"
                    type="email"
                    value={newClientData.email}
                    onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newClientCompany">Company</Label>
                  <Input
                    id="newClientCompany"
                    value={newClientData.company}
                    onChange={(e) => setNewClientData({ ...newClientData, company: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newClientContactInfo">Contact Info</Label>
                  <Input
                    id="newClientContactInfo"
                    value={newClientData.contactInfo}
                    onChange={(e) => setNewClientData({ ...newClientData, contactInfo: e.target.value })}
                    placeholder="Phone, address, etc."
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateClientDialog(false)
                      setNewClientData({ name: "", email: "", company: "", contactInfo: "" })
                    }}
                    disabled={creatingClient}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creatingClient}>
                    {creatingClient ? "Creating..." : "Create Client"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
  </>
  )
}
