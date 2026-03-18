"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatDate } from "@/lib/utils"

export default function NewBillPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [clients, setClients] = useState<Array<{ id: string; name: string; company?: string | null }>>([])
  const [leads, setLeads] = useState<Array<{ id: string; name: string; company?: string | null }>>([])
  const [proposals, setProposals] = useState<Array<{ id: string; title: string }>>([])
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
  const [formData, setFormData] = useState({
    proposalId: "",
    projectId: "",
    clientId: "",
    leadId: "",
    subtotal: "",
    description: "",
    paymentDetailsId: "",
    taxInclusive: false,
    taxRate: "0",
    discountPercent: "",
    discountAmount: "",
    dueDate: "",
  })
  const [calculatedAmount, setCalculatedAmount] = useState(0)
  const [paymentDetails, setPaymentDetails] = useState<Array<{ id: string; name: string; isDefault: boolean }>>([])
  const [unbilledItems, setUnbilledItems] = useState<{
    timesheetEntries: Array<{ id: string; date: string; hours: number; rate: number | null; amount: number; description: string | null; user: { id: string; name: string; email: string } }>
    charges: Array<{ id: string; description: string; amount: number; quantity: number | null; project?: { id: string; name: string } }>
    totals: { timesheets: number; charges: number; total: number }
  } | null>(null)
  const [selectedTimesheetIds, setSelectedTimesheetIds] = useState<string[]>([])
  const [selectedChargeIds, setSelectedChargeIds] = useState<string[]>([])
  const [loadingUnbilled, setLoadingUnbilled] = useState(false)

  // Initialize from URL params
  useEffect(() => {
    const leadIdParam = searchParams.get("leadId")
    const timesheetEntryIdsParam = searchParams.get("timesheetEntryIds")
    
    if (leadIdParam) {
      setFormData(prev => ({ ...prev, leadId: leadIdParam }))
      if (timesheetEntryIdsParam) {
        setSelectedTimesheetIds(timesheetEntryIdsParam.split(",").filter(Boolean))
      }
    }
  }, [searchParams])

  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then((result) => {
        // Handle paginated response format
        const data = result.data || result
        setClients(data)
      })
      .catch(console.error)
    
    fetch("/api/leads")
      .then((res) => res.json())
      .then((data) => setLeads(data.filter((l: any) => !l.deletedAt && !l.archivedAt)))
      .catch(console.error)
    
    fetch("/api/payment-details")
      .then((res) => res.json())
      .then((data) => {
        setPaymentDetails(data)
        // Set default payment details if available
        const defaultPd = data.find((pd: any) => pd.isDefault)
        if (defaultPd) {
          setFormData(prev => ({ ...prev, paymentDetailsId: defaultPd.id }))
        }
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (formData.clientId) {
      Promise.all([
        fetch(`/api/proposals?clientId=${formData.clientId}`).then(res => res.json()).catch(() => ({ data: [] })),
        fetch(`/api/projects?clientId=${formData.clientId}`).then(res => res.json()).catch(() => []),
      ])
        .then(([proposalsResult, projectsResult]) => {
          // Handle paginated response format
          const proposalsData = proposalsResult.data || proposalsResult
          const approvedProposals = proposalsData.filter((p: any) => p.status === "APPROVED")
          setProposals(approvedProposals)
          // Handle paginated response format for projects
          const projectsData = projectsResult.data || projectsResult
          setProjects(projectsData.filter((p: any) => !p.deletedAt))
        })
        .catch(console.error)
    } else {
      setProposals([])
      setProjects([])
      setUnbilledItems(null)
      setSelectedTimesheetIds([])
      setSelectedChargeIds([])
      setFormData((prev) => ({ ...prev, proposalId: "", projectId: "" }))
    }
  }, [formData.clientId])

  // Fetch unbilled items when lead is selected
  useEffect(() => {
    if (formData.leadId) {
      setLoadingUnbilled(true)
      fetch(`/api/leads/${formData.leadId}/timesheet?archived=false`)
        .then(res => res.json())
        .then(data => {
          const unbilled = data.filter((e: any) => e.billable && !e.billed)
          const timesheetEntries = unbilled.map((e: any) => ({
            id: e.id,
            date: e.date,
            hours: e.hours,
            rate: e.rate,
            amount: (e.rate || 0) * e.hours,
            description: e.description,
            user: e.user,
          }))
          setUnbilledItems({
            timesheetEntries,
            charges: [],
            totals: {
              timesheets: timesheetEntries.reduce((sum: number, e: any) => sum + e.amount, 0),
              charges: 0,
              total: timesheetEntries.reduce((sum: number, e: any) => sum + e.amount, 0),
            },
          })
          // Auto-select all unbilled entries if coming from GenerateInvoiceButton
          if (searchParams.get("timesheetEntryIds")) {
            const ids = searchParams.get("timesheetEntryIds")?.split(",").filter(Boolean) || []
            setSelectedTimesheetIds(ids)
          } else {
            setSelectedTimesheetIds(timesheetEntries.map((e: any) => e.id))
          }
          setSelectedChargeIds([])
        })
        .catch(err => {
          console.error("Error fetching lead timesheet entries:", err)
          setUnbilledItems(null)
        })
        .finally(() => setLoadingUnbilled(false))
    }
  }, [formData.leadId, searchParams])

  // Fetch unbilled items when project is selected
  useEffect(() => {
    if (formData.projectId) {
      setLoadingUnbilled(true)
      fetch(`/api/projects/${formData.projectId}/unbilled-items`)
        .then(res => res.json())
        .then(data => {
          setUnbilledItems(data)
          setSelectedTimesheetIds([])
          setSelectedChargeIds([])
        })
        .catch(err => {
          console.error("Error fetching unbilled items:", err)
          setUnbilledItems(null)
        })
        .finally(() => setLoadingUnbilled(false))
    } else if (formData.clientId && !formData.projectId && !formData.leadId) {
      // Fetch unbilled items for all client projects
      setLoadingUnbilled(true)
      fetch(`/api/clients/${formData.clientId}/unbilled-items`)
        .then(res => res.json())
        .then(data => {
          setUnbilledItems(data)
          setSelectedTimesheetIds([])
          setSelectedChargeIds([])
        })
        .catch(err => {
          console.error("Error fetching unbilled items:", err)
          setUnbilledItems(null)
        })
        .finally(() => setLoadingUnbilled(false))
    } else {
      setUnbilledItems(null)
      setSelectedTimesheetIds([])
      setSelectedChargeIds([])
    }
  }, [formData.projectId, formData.clientId])

  useEffect(() => {
    if (formData.proposalId && proposals.length > 0) {
      const proposal = proposals.find((p) => p.id === formData.proposalId)
      if (proposal) {
        fetch(`/api/proposals/${formData.proposalId}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.amount) {
              setFormData((prev) => ({ ...prev, subtotal: data.amount.toString() }))
            }
          })
          .catch(console.error)
      }
    }
  }, [formData.proposalId, proposals])

  // Calculate totals when tax/discount changes or selected items change
  useEffect(() => {
    // Calculate subtotal from selected items if any are selected, otherwise use manual subtotal
    let subtotal = parseFloat(formData.subtotal) || 0
    
    if (unbilledItems && (selectedTimesheetIds.length > 0 || selectedChargeIds.length > 0)) {
      let itemsSubtotal = 0
      
      // Add selected timesheet amounts
      selectedTimesheetIds.forEach(id => {
        const entry = unbilledItems.timesheetEntries.find(e => e.id === id)
        if (entry) {
          itemsSubtotal += entry.amount
        }
      })
      
      // Add selected charge amounts
      selectedChargeIds.forEach(id => {
        const charge = unbilledItems.charges.find(c => c.id === id)
        if (charge) {
          itemsSubtotal += charge.amount
        }
      })
      
      // Use items subtotal if items are selected
      if (itemsSubtotal > 0) {
        subtotal = itemsSubtotal
        // Update formData subtotal when items are selected
        setFormData(prev => ({ ...prev, subtotal: itemsSubtotal.toFixed(2) }))
      }
    }
    
    const taxRate = parseFloat(formData.taxRate) || 0
    const discountPercent = parseFloat(formData.discountPercent) || 0
    const discountAmount = parseFloat(formData.discountAmount) || 0

    // Calculate discount
    let discountValue = 0
    if (discountPercent > 0) {
      discountValue = (subtotal * discountPercent) / 100
    } else if (discountAmount > 0) {
      discountValue = discountAmount
    }

    const afterDiscount = subtotal - discountValue

    // Calculate tax and final amount
    let finalAmount = afterDiscount
    if (taxRate > 0) {
      if (formData.taxInclusive) {
        // Tax is included, so final amount is afterDiscount
        finalAmount = afterDiscount
      } else {
        // Tax is added on top
        const taxAmount = (afterDiscount * taxRate) / 100
        finalAmount = afterDiscount + taxAmount
      }
    }

    setCalculatedAmount(finalAmount)
  }, [formData.subtotal, formData.taxRate, formData.taxInclusive, formData.discountPercent, formData.discountAmount, selectedTimesheetIds, selectedChargeIds, unbilledItems])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    
    // Validate that either clientId or leadId is provided
    if (!formData.clientId && !formData.leadId) {
      setError("Please select either a client or a lead")
      return
    }
    
    setLoading(true)

    try {
      const response = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId: formData.proposalId || undefined,
          projectId: formData.projectId || undefined,
          clientId: formData.clientId || undefined,
          leadId: formData.leadId || undefined,
          subtotal: formData.subtotal ? parseFloat(formData.subtotal) : undefined,
          description: formData.description || undefined,
          paymentDetailsId: formData.paymentDetailsId || undefined,
          taxInclusive: formData.taxInclusive,
          taxRate: formData.taxRate ? parseFloat(formData.taxRate) : null,
          discountPercent: formData.discountPercent ? parseFloat(formData.discountPercent) : null,
          discountAmount: formData.discountAmount ? parseFloat(formData.discountAmount) : null,
          dueDate: formData.dueDate || undefined,
          timesheetEntryIds: selectedTimesheetIds.length > 0 ? selectedTimesheetIds : undefined,
          chargeIds: selectedChargeIds.length > 0 ? selectedChargeIds : undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Failed to create invoice")
      } else {
        const bill = await response.json()
        router.push(`/dashboard/bills/${bill.id}`)
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Create New Invoice</h1>
      <Card>
        <CardHeader>
          <CardTitle>Invoice Information</CardTitle>
          <CardDescription>Enter the invoice details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Client</Label>
                <Select
                  id="clientId"
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value, leadId: "", proposalId: "", projectId: "" })}
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} {client.company ? `(${client.company})` : ""}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="leadId">Lead</Label>
                <Select
                  id="leadId"
                  value={formData.leadId}
                  onChange={(e) => setFormData({ ...formData, leadId: e.target.value, clientId: "", proposalId: "", projectId: "" })}
                >
                  <option value="">Select a lead</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name} {lead.company ? `(${lead.company})` : ""}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {!formData.clientId && !formData.leadId && (
              <p className="text-sm text-red-600">Please select either a client or a lead</p>
            )}

            {formData.clientId && proposals.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="proposalId">From Proposal (Optional)</Label>
                <Select
                  id="proposalId"
                  value={formData.proposalId}
                  onChange={(e) => setFormData({ ...formData, proposalId: e.target.value })}
                >
                  <option value="">No proposal</option>
                  {proposals.map((proposal) => (
                    <option key={proposal.id} value={proposal.id}>
                      {proposal.title}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {formData.clientId && projects.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="projectId">From Project (Optional)</Label>
                <Select
                  id="projectId"
                  value={formData.projectId}
                  onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                >
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="subtotal">Subtotal (Original Amount) *</Label>
              <Input
                id="subtotal"
                type="number"
                step="0.01"
                min="0"
                value={formData.subtotal}
                onChange={(e) => setFormData({ ...formData, subtotal: e.target.value })}
                required
              />
              <p className="text-xs text-gray-500">Total amount before discount and tax</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description of Services/Products</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                placeholder="Describe the services or products being invoiced..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentDetailsId">Payment Details</Label>
              <Select
                id="paymentDetailsId"
                value={formData.paymentDetailsId}
                onChange={(e) => setFormData({ ...formData, paymentDetailsId: e.target.value })}
              >
                <option value="">No payment details</option>
                {paymentDetails.map((pd) => (
                  <option key={pd.id} value={pd.id}>
                    {pd.name} {pd.isDefault ? "(Default)" : ""}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-gray-500">Select payment details to display at the bottom of the invoice PDF</p>
            </div>

            {/* Unbilled Items Section */}
            {(formData.projectId || (formData.clientId && !formData.projectId)) && (
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Unbilled Items</h3>
                  {unbilledItems && (unbilledItems.timesheetEntries.length > 0 || unbilledItems.charges.length > 0) && (
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const allTimesheetIds = unbilledItems.timesheetEntries.map(e => e.id)
                          const allChargeIds = unbilledItems.charges.map(c => c.id)
                          setSelectedTimesheetIds(allTimesheetIds)
                          setSelectedChargeIds(allChargeIds)
                        }}
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedTimesheetIds([])
                          setSelectedChargeIds([])
                        }}
                      >
                        Clear All
                      </Button>
                    </div>
                  )}
                </div>

                {loadingUnbilled ? (
                  <p className="text-sm text-gray-500">Loading unbilled items...</p>
                ) : unbilledItems && (unbilledItems.timesheetEntries.length > 0 || unbilledItems.charges.length > 0) ? (
                  <div className="space-y-4">
                    {unbilledItems.timesheetEntries.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Timesheet Entries</h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto border rounded p-3">
                          {unbilledItems.timesheetEntries.map((entry) => (
                            <label
                              key={entry.id}
                              className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                            >
                              <Checkbox
                                checked={selectedTimesheetIds.includes(entry.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedTimesheetIds([...selectedTimesheetIds, entry.id])
                                  } else {
                                    setSelectedTimesheetIds(selectedTimesheetIds.filter(id => id !== entry.id))
                                  }
                                }}
                              />
                              <div className="flex-1 grid grid-cols-4 gap-2 text-sm">
                                <span>{formatDate(entry.date)}</span>
                                <span>{entry.user.name}</span>
                                <span>{entry.hours}h @ {formatCurrency(entry.rate || 0)}</span>
                                <span className="text-right font-medium">{formatCurrency(entry.amount)}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Total: {formatCurrency(unbilledItems.totals.timesheets)}
                        </p>
                      </div>
                    )}

                    {unbilledItems.charges.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Charges</h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto border rounded p-3">
                          {unbilledItems.charges.map((charge) => (
                            <label
                              key={charge.id}
                              className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                            >
                              <Checkbox
                                checked={selectedChargeIds.includes(charge.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedChargeIds([...selectedChargeIds, charge.id])
                                  } else {
                                    setSelectedChargeIds(selectedChargeIds.filter(id => id !== charge.id))
                                  }
                                }}
                              />
                              <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
                                <span className="col-span-2">{charge.description}</span>
                                <span className="text-right font-medium">{formatCurrency(charge.amount)}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Total: {formatCurrency(unbilledItems.totals.charges)}
                        </p>
                      </div>
                    )}

                    {(selectedTimesheetIds.length > 0 || selectedChargeIds.length > 0) && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                        <p className="text-sm font-medium text-blue-900">
                          Selected: {selectedTimesheetIds.length} timesheet{selectedTimesheetIds.length !== 1 ? "s" : ""}, {selectedChargeIds.length} charge{selectedChargeIds.length !== 1 ? "s" : ""}
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          Subtotal will be calculated from selected items
                        </p>
                      </div>
                    )}
                  </div>
                ) : unbilledItems ? (
                  <p className="text-sm text-gray-500">No unbilled items found for this {formData.projectId ? "project" : "client"}</p>
                ) : null}
              </div>
            )}

            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold">Discount</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discountPercent">Discount Percentage (%)</Label>
                  <Input
                    id="discountPercent"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.discountPercent}
                    onChange={(e) => {
                      setFormData({ ...formData, discountPercent: e.target.value, discountAmount: "" })
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discountAmount">Discount Amount</Label>
                  <Input
                    id="discountAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.discountAmount}
                    onChange={(e) => {
                      setFormData({ ...formData, discountAmount: e.target.value, discountPercent: "" })
                    }}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">Enter either percentage or amount (not both)</p>
            </div>

            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold">Tax</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="taxInclusive"
                    checked={formData.taxInclusive}
                    onCheckedChange={(checked) => setFormData({ ...formData, taxInclusive: !!checked })}
                  />
                  <Label htmlFor="taxInclusive" className="cursor-pointer">
                    Tax is included in the amount
                  </Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <Select
                    id="taxRate"
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                  >
                    <option value="0">0%</option>
                    <option value="16">16%</option>
                    <option value="22">22%</option>
                    <option value="23">23%</option>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label>Calculated Total Amount</Label>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-lg font-semibold text-blue-800">
                  {formatCurrency(calculatedAmount)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>

            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}

            <div className="flex space-x-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Invoice"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
