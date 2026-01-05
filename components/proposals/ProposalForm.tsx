"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ProposalType } from "@prisma/client"
import { Plus, Trash2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { PaymentTermsSection } from "./PaymentTermsSection"

interface ProposalFormProps {
  onSubmit: (data: any) => Promise<void>
  initialData?: any
  clients: Array<{ id: string; name: string; company?: string | null; defaultDiscountPercent?: number | null; defaultDiscountAmount?: number | null }>
  leads?: Array<{ id: string; name: string; company?: string | null }>
  users?: Array<{ id: string; name: string; email: string; defaultHourlyRate?: number | null }>
  loading?: boolean
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

export function ProposalForm({ onSubmit, initialData, clients, leads = [], users = [], loading }: ProposalFormProps) {
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
    retainerMonthlyAmount: initialData?.retainerMonthlyAmount || 0,
    retainerHourlyCap: initialData?.retainerHourlyCap || 0,
    blendedRate: initialData?.blendedRate || 0,
    useBlendedRate: initialData?.useBlendedRate ?? false,
    successFeePercent: initialData?.successFeePercent || 0,
    successFeeAmount: initialData?.successFeeAmount || 0,
    successFeeValue: initialData?.successFeeValue || 0,
    fixedAmount: initialData?.fixedAmount || 0,
    outOfScopeHourlyRate: initialData?.outOfScopeHourlyRate || 0,
    // Mixed model billing methods (array of selected methods)
    mixedModelMethods: initialData?.mixedModelMethods || [],
    useMilestones: initialData?.milestones && initialData.milestones.length > 0 ? true : false, // Enable if milestones exist
  })

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
  
  const [proposalPaymentTerm, setProposalPaymentTerm] = useState<any>(initialData?.paymentTerms?.find((pt: any) => !pt.proposalItemId) || null)
  const [itemPaymentTerms, setItemPaymentTerms] = useState<Array<any>>(
    items.map((_, index) => initialData?.paymentTerms?.find((pt: any) => pt.proposalItemId === initialData?.items?.[index]?.id) || null)
  )

  const [errors, setErrors] = useState<Record<string, string>>({})

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

  const calculateLineItemAmount = (item: LineItem): number => {
    let baseAmount = 0
    
    // Use blended rate if enabled, otherwise use item rate
    const effectiveRate = formData.useBlendedRate && formData.blendedRate > 0 
      ? formData.blendedRate 
      : (item.rate || item.unitPrice || 0)
    
    if (item.quantity && effectiveRate) {
      baseAmount = item.quantity * effectiveRate
    } else if (item.unitPrice && !formData.useBlendedRate) {
      baseAmount = item.unitPrice
    } else {
      baseAmount = item.amount || 0
    }
    
    // Apply line item discount
    if (item.discountPercent) {
      baseAmount = baseAmount * (1 - item.discountPercent / 100)
    } else if (item.discountAmount) {
      baseAmount = baseAmount - item.discountAmount
    }
    
    return Math.max(0, baseAmount)
  }

  const calculateSubtotal = (): number => {
    return items.reduce((sum, item) => sum + calculateLineItemAmount(item), 0)
  }

  const calculateClientDiscount = (): number => {
    const subtotal = calculateSubtotal()
    if (formData.clientDiscountType === "percent") {
      return subtotal * (formData.clientDiscountPercent / 100)
    } else if (formData.clientDiscountType === "amount") {
      return formData.clientDiscountAmount
    }
    return 0
  }

  const calculateTax = (): number => {
    if (!formData.taxRate || formData.taxRate === 0) return 0
    const subtotal = calculateSubtotal()
    const afterDiscount = subtotal - calculateClientDiscount()
    
    if (formData.taxInclusive) {
      // Tax is already included, calculate the tax portion
      return afterDiscount * (formData.taxRate / (100 + formData.taxRate))
    } else {
      // Tax is added on top
      return afterDiscount * (formData.taxRate / 100)
    }
  }

  const calculateGrandTotal = (): number => {
    const subtotal = calculateSubtotal()
    const discount = calculateClientDiscount()
    const tax = calculateTax()
    const afterDiscount = subtotal - discount
    
    if (formData.taxInclusive) {
      return afterDiscount
    } else {
      return afterDiscount + tax
    }
  }

  const addItem = () => {
    const newItem: LineItem = {
      description: "",
      amount: 0,
    }
    
    if (formData.type === "HOURLY" || formData.type === "MIXED_MODEL") {
      newItem.quantity = 0
      newItem.rate = 0
    } else {
      newItem.unitPrice = 0
    }
    
    if (formData.type === "MIXED_MODEL") {
      newItem.billingMethod = "fixed"
    }
    
    // Date field removed - dates are only for actual billing/timesheet entries, not proposals
    setItems([...items, newItem])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    
    // Auto-calculate amount when relevant fields change
    if (field === "quantity" || field === "rate" || field === "unitPrice" || field === "discountPercent" || field === "discountAmount") {
      updated[index].amount = calculateLineItemAmount(updated[index])
    }
    
    // Auto-fill rate from person's default rate
    if (field === "personId" && value) {
      const person = users.find(u => u.id === value)
      if (person?.defaultHourlyRate) {
        updated[index].rate = person.defaultHourlyRate
        updated[index].amount = calculateLineItemAmount(updated[index])
      }
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
      items: items.map(item => ({
        billingMethod: item.billingMethod || undefined,
        personId: item.personId || undefined,
        description: item.description,
        quantity: item.quantity || undefined,
        rate: item.rate || undefined,
        unitPrice: item.unitPrice || undefined,
        discountPercent: item.discountPercent || undefined,
        discountAmount: item.discountAmount || undefined,
        amount: calculateLineItemAmount(item),
        // date field removed - dates are only for actual billing/timesheet entries
        milestoneIds: item.milestoneIds || [], // Include milestone IDs for this line item
      })),
      milestones: formData.useMilestones && milestones.length > 0 ? milestones.map(m => ({
        id: m.id, // Include ID for matching on server
        name: m.name,
        description: m.description || undefined,
        amount: m.amount || undefined,
        percent: m.percent || undefined,
        dueDate: m.dueDate || undefined,
      })) : undefined,
      paymentTerms: [
        ...(proposalPaymentTerm ? [{
          ...proposalPaymentTerm,
          proposalId: undefined,
          proposalItemId: undefined,
        }] : []),
        ...items.map((_, index) => itemPaymentTerms[index]).filter(Boolean).map((term, index) => ({
          ...term,
          proposalId: undefined,
          proposalItemId: undefined, // Will be set on server
        })),
      ],
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
              <Label htmlFor="clientId">Client *</Label>
              <Select
                id="clientId"
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} {client.company ? `(${client.company})` : ""}
                  </option>
                ))}
              </Select>
              {errors.clientId && (
                <p className="text-sm text-destructive">{errors.clientId}</p>
              )}
            </div>

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

            <div className="space-y-2">
              <Label htmlFor="type">Billing Method *</Label>
              <Select
                id="type"
                value={formData.type}
                onChange={(e) => {
                  setFormData({ ...formData, type: e.target.value as ProposalType })
                  setItems([])
                  setMilestones([])
                }}
              >
                <option value="FIXED_FEE">Fixed Fee (with milestones)</option>
                <option value="HOURLY">Hourly (with estimate and range)</option>
                <option value="RETAINER">Retainer (with drawdown rules)</option>
                <option value="SUCCESS_FEE">Success Fee</option>
                <option value="MIXED_MODEL">Mixed Model (Fixed + Hourly)</option>
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

      {/* Payment Terms */}
      <PaymentTermsSection
        currency={formData.currency}
        milestones={milestones.map((m, index) => ({ id: index.toString(), name: m.name }))}
        proposalLevel={proposalPaymentTerm}
        itemLevel={itemPaymentTerms}
        onProposalLevelChange={(term) => setProposalPaymentTerm(term)}
        onItemLevelChange={(index, term) => {
          const updated = [...itemPaymentTerms]
          updated[index] = term
          setItemPaymentTerms(updated)
        }}
        itemCount={items.length}
      />

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

      {formData.type === "HOURLY" && (
        <Card>
          <CardHeader>
            <CardTitle>Hourly Rate Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estimatedHours">Estimated Hours</Label>
                <Input
                  id="estimatedHours"
                  type="number"
                  step="0.25"
                  min="0"
                  value={formData.estimatedHours}
                  onChange={(e) => setFormData({ ...formData, estimatedHours: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hourlyCapHours">Maximum Hours Cap (Optional)</Label>
                <Input
                  id="hourlyCapHours"
                  type="number"
                  step="0.25"
                  min="0"
                  value={formData.hourlyCapHours}
                  onChange={(e) => setFormData({ ...formData, hourlyCapHours: parseFloat(e.target.value) || 0 })}
                  placeholder="Cap total billable hours at this amount"
                />
                <p className="text-xs text-gray-500">Optional: Cap total billable hours at this amount</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hourlyRateRangeMin">Minimum Rate ({selectedCurrency.symbol}/hr)</Label>
                <Input
                  id="hourlyRateRangeMin"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.hourlyRateRangeMin}
                  onChange={(e) => setFormData({ ...formData, hourlyRateRangeMin: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hourlyRateRangeMax">Maximum Rate ({selectedCurrency.symbol}/hr)</Label>
                <Input
                  id="hourlyRateRangeMax"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.hourlyRateRangeMax}
                  onChange={(e) => setFormData({ ...formData, hourlyRateRangeMax: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {formData.type === "RETAINER" && (
        <Card>
          <CardHeader>
            <CardTitle>Retainer Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="retainerMonthlyAmount">Monthly Amount ({selectedCurrency.symbol})</Label>
                <Input
                  id="retainerMonthlyAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.retainerMonthlyAmount}
                  onChange={(e) => setFormData({ ...formData, retainerMonthlyAmount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retainerHourlyCap">Hourly Cap ({selectedCurrency.symbol})</Label>
                <Input
                  id="retainerHourlyCap"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.retainerHourlyCap}
                  onChange={(e) => setFormData({ ...formData, retainerHourlyCap: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Blended Rate Option - Available for all billing methods */}
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

      {formData.type === "SUCCESS_FEE" && (
        <Card>
          <CardHeader>
            <CardTitle>Success Fee Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="successFeePercent">Success Fee Percentage (%)</Label>
                <Input
                  id="successFeePercent"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.successFeePercent}
                  onChange={(e) => setFormData({ ...formData, successFeePercent: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="successFeeAmount">Fixed Success Fee ({selectedCurrency.symbol})</Label>
                <Input
                  id="successFeeAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.successFeeAmount}
                  onChange={(e) => setFormData({ ...formData, successFeeAmount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="successFeeValue">Transaction/Deal Value ({selectedCurrency.symbol})</Label>
                <Input
                  id="successFeeValue"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.successFeeValue}
                  onChange={(e) => setFormData({ ...formData, successFeeValue: parseFloat(e.target.value) || 0 })}
                  placeholder="For percentage calculation"
                />
              </div>
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
                        : formData.mixedModelMethods.filter(m => m !== "FIXED_FEE")
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
                        : formData.mixedModelMethods.filter(m => m !== "HOURLY")
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
                        : formData.mixedModelMethods.filter(m => m !== "RETAINER")
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
                        : formData.mixedModelMethods.filter(m => m !== "SUCCESS_FEE")
                      setFormData({ ...formData, mixedModelMethods: methods })
                    }}
                    className="rounded"
                  />
                  <span>Success Fee</span>
                </label>
              </div>
            </div>

            {/* Show configuration fields for selected methods */}
            {formData.mixedModelMethods.includes("FIXED_FEE") && (
              <div className="space-y-2 p-4 border rounded">
                <Label className="font-semibold">Fixed Fee Configuration</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Fixed amount"
                  value={formData.fixedAmount}
                  onChange={(e) => setFormData({ ...formData, fixedAmount: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}

            {formData.mixedModelMethods.includes("HOURLY") && (
              <div className="space-y-2 p-4 border rounded">
                <Label className="font-semibold">Hourly Configuration</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    placeholder="Estimated hours"
                    value={formData.estimatedHours}
                    onChange={(e) => setFormData({ ...formData, estimatedHours: parseFloat(e.target.value) || 0 })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Min rate"
                    value={formData.hourlyRateRangeMin}
                    onChange={(e) => setFormData({ ...formData, hourlyRateRangeMin: parseFloat(e.target.value) || 0 })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Max rate"
                    value={formData.hourlyRateRangeMax}
                    onChange={(e) => setFormData({ ...formData, hourlyRateRangeMax: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            )}

            {formData.mixedModelMethods.includes("RETAINER") && (
              <div className="space-y-2 p-4 border rounded">
                <Label className="font-semibold">Retainer Configuration</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Monthly amount"
                    value={formData.retainerMonthlyAmount}
                    onChange={(e) => setFormData({ ...formData, retainerMonthlyAmount: parseFloat(e.target.value) || 0 })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Hourly cap"
                    value={formData.retainerHourlyCap}
                    onChange={(e) => setFormData({ ...formData, retainerHourlyCap: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            )}

            {formData.mixedModelMethods.includes("BLENDED_RATE") && (
              <div className="space-y-2 p-4 border rounded">
                <Label className="font-semibold">Blended Rate Configuration</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Blended rate"
                  value={formData.blendedRate}
                  onChange={(e) => setFormData({ ...formData, blendedRate: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}

            {formData.mixedModelMethods.includes("SUCCESS_FEE") && (
              <div className="space-y-2 p-4 border rounded">
                <Label className="font-semibold">Success Fee Configuration</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="Success fee %"
                    value={formData.successFeePercent}
                    onChange={(e) => setFormData({ ...formData, successFeePercent: parseFloat(e.target.value) || 0 })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Fixed success fee"
                    value={formData.successFeeAmount}
                    onChange={(e) => setFormData({ ...formData, successFeeAmount: parseFloat(e.target.value) || 0 })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Transaction value"
                    value={formData.successFeeValue}
                    onChange={(e) => setFormData({ ...formData, successFeeValue: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            )}

            {formData.mixedModelMethods.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                Select at least one billing method above
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Line Items Section - Available for all billing methods */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button type="button" onClick={addItem} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Line Item
            </Button>
          </div>
        </CardHeader>
          <CardContent className="space-y-6">
            {/* Milestone Enablement Checkbox */}
            <div className="flex items-center space-x-2 p-4 border rounded">
              <input
                type="checkbox"
                id="useMilestones"
                checked={formData.useMilestones}
                onChange={(e) => {
                  setFormData({ ...formData, useMilestones: e.target.checked })
                  if (!e.target.checked) {
                    // Clear milestones and milestone assignments when disabled
                    setMilestones([])
                    setItems(items.map(item => ({ ...item, milestoneIds: [] })))
                  }
                }}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="useMilestones" className="cursor-pointer font-semibold">
                Enable milestone payments
              </Label>
              <p className="text-sm text-gray-500">
                Define milestones and assign them to specific line items
              </p>
            </div>

            {/* Milestone Definition Section - Only show when enabled */}
            {formData.useMilestones && (
              <div className="space-y-4 p-4 border rounded bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">Define Milestones</h3>
                    <p className="text-sm text-gray-500">Create milestones that can be assigned to line items below</p>
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
            {items.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No items added yet. Click &quot;Add Line Item&quot; to get started.
              </p>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => (
                  <Card key={index}>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {formData.type === "MIXED_MODEL" && (
                          <div className="space-y-2">
                            <Label>Billing Method</Label>
                            <Select
                              value={item.billingMethod || formData.mixedModelMethods[0] || ""}
                              onChange={(e) => updateItem(index, "billingMethod", e.target.value)}
                            >
                              <option value="">Select method</option>
                              {formData.mixedModelMethods.map((method) => (
                                <option key={method} value={method}>
                                  {method.replace("_", " ")}
                                </option>
                              ))}
                            </Select>
                          </div>
                        )}

                        {(formData.type === "HOURLY" || (formData.type === "MIXED_MODEL" && (item.billingMethod === "HOURLY" || item.billingMethod === "hourly"))) && (
                          <>
                            {users.length > 0 && (
                              <div className="space-y-2">
                                <Label>Person</Label>
                                <Select
                                  value={item.personId || ""}
                                  onChange={(e) => updateItem(index, "personId", e.target.value)}
                                >
                                  <option value="">Select person</option>
                                  {users.map((user) => (
                                    <option key={user.id} value={user.id}>
                                      {user.name} {user.defaultHourlyRate ? `(${selectedCurrency.symbol}${user.defaultHourlyRate}/hr)` : ""}
                                    </option>
                                  ))}
                                </Select>
                              </div>
                            )}
                          </>
                        )}

                        <div className={`space-y-2 ${formData.type === "MIXED_MODEL" ? "" : "md:col-span-2"}`}>
                          <Label>Description *</Label>
                          <Input
                            value={item.description}
                            onChange={(e) => updateItem(index, "description", e.target.value)}
                            required
                          />
                        </div>

                        {(formData.type === "HOURLY" || (formData.type === "MIXED_MODEL" && (item.billingMethod === "HOURLY" || item.billingMethod === "hourly"))) ? (
                          <>
                            <div className="space-y-2">
                              <Label>Hours</Label>
                              <Input
                                type="number"
                                step="0.25"
                                min="0"
                                value={item.quantity || 0}
                                onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Rate ({selectedCurrency.symbol}/hr)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.useBlendedRate ? formData.blendedRate : (item.rate || 0)}
                                onChange={(e) => updateItem(index, "rate", parseFloat(e.target.value) || 0)}
                                disabled={formData.useBlendedRate}
                                placeholder={formData.useBlendedRate ? "Using blended rate" : "Enter rate"}
                              />
                              {formData.useBlendedRate && (
                                <p className="text-xs text-gray-500">Using blended rate: {selectedCurrency.symbol}{formData.blendedRate}/hr</p>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="space-y-2">
                              <Label>Quantity</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.quantity || ""}
                                onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || undefined)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Unit Price ({selectedCurrency.symbol})</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.unitPrice || 0}
                                onChange={(e) => updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          </>
                        )}

                        <div className="space-y-2">
                          <Label>Discount %</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={item.discountPercent || ""}
                            onChange={(e) => updateItem(index, "discountPercent", parseFloat(e.target.value) || undefined)}
                            placeholder="0"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Discount Amount ({selectedCurrency.symbol})</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.discountAmount || ""}
                            onChange={(e) => updateItem(index, "discountAmount", parseFloat(e.target.value) || undefined)}
                            placeholder="0"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Line Total ({selectedCurrency.symbol})</Label>
                          <Input
                            type="number"
                            value={calculateLineItemAmount(item).toFixed(2)}
                            disabled
                            className="font-semibold bg-gray-50"
                          />
                        </div>

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
          </CardContent>
        </Card>

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

      <div className="flex space-x-4">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : initialData ? "Update Proposal" : "Create Proposal"}
        </Button>
      </div>
    </form>
  )
}
