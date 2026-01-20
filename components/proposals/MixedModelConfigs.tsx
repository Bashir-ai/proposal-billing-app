"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { RetainerPaymentTerms } from "./RetainerPaymentTerms"
import { ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"

interface MixedModelConfigsProps {
  formData: any
  setFormData: (data: any) => void
  selectedCurrency: { code: string; symbol: string; name: string }
  clientProjects?: Array<{ id: string; name: string }>
  clientId?: string
}

const CURRENCIES: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
}

export function FixedFeeConfig({ formData, setFormData, selectedCurrency }: MixedModelConfigsProps) {
  const currencySymbol = CURRENCIES[selectedCurrency.code] || selectedCurrency.symbol

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader>
        <CardTitle>Fixed Fee Configuration</CardTitle>
        <CardDescription>Configure fixed fee settings for this proposal</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fixedAmount">Fixed Amount ({currencySymbol})</Label>
          <Input
            id="fixedAmount"
            type="number"
            step="0.01"
            min="0"
            placeholder="Enter fixed fee amount"
            value={formData.fixedAmount || 0}
            onChange={(e) => setFormData({ ...formData, fixedAmount: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="outOfScopeHourlyRate">Out of Scope Hourly Rate ({currencySymbol}/hr)</Label>
          <Input
            id="outOfScopeHourlyRate"
            type="number"
            step="0.01"
            min="0"
            placeholder="Hourly rate for out of scope work"
            value={formData.outOfScopeHourlyRate || 0}
            onChange={(e) => setFormData({ ...formData, outOfScopeHourlyRate: parseFloat(e.target.value) || 0 })}
          />
          <p className="text-xs text-gray-500">Rate to charge for work outside the fixed fee scope</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function HourlyConfig({ formData, setFormData, selectedCurrency }: MixedModelConfigsProps) {
  const currencySymbol = CURRENCIES[selectedCurrency.code] || selectedCurrency.symbol
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <Card className="border-l-4 border-l-green-500">
      <CardHeader 
        className="cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Hourly Configuration</CardTitle>
            <CardDescription>Configure hourly billing settings and estimates</CardDescription>
          </div>
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimatedHours">Estimated Hours</Label>
              <Input
                id="estimatedHours"
                type="number"
                step="0.25"
                min="0"
                placeholder="Estimated hours"
                value={formData.estimatedHours || 0}
                onChange={(e) => setFormData({ ...formData, estimatedHours: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hourlyRateRangeMin">Min Rate ({currencySymbol}/hr)</Label>
              <Input
                id="hourlyRateRangeMin"
                type="number"
                step="0.01"
                min="0"
                placeholder="Minimum rate"
                value={formData.hourlyRateRangeMin || 0}
                onChange={(e) => setFormData({ ...formData, hourlyRateRangeMin: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hourlyRateRangeMax">Max Rate ({currencySymbol}/hr)</Label>
              <Input
                id="hourlyRateRangeMax"
                type="number"
                step="0.01"
                min="0"
                placeholder="Maximum rate"
                value={formData.hourlyRateRangeMax || 0}
                onChange={(e) => setFormData({ ...formData, hourlyRateRangeMax: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="pt-4 border-t space-y-4">
            <div>
              <Label className="text-base font-semibold mb-3 block">Hourly Rate Configuration</Label>
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
                          placeholder={`${currencySymbol}/hr`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="hourlyIsEstimate"
                checked={formData.hourlyIsEstimate || false}
                onChange={(e) => setFormData({ ...formData, hourlyIsEstimate: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="hourlyIsEstimate" className="cursor-pointer">
                Mark as estimate
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="hourlyIsCapped"
                checked={formData.hourlyIsCapped || false}
                onChange={(e) => setFormData({ ...formData, hourlyIsCapped: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="hourlyIsCapped" className="cursor-pointer">
                Cap the total amount
              </Label>
            </div>

            {formData.hourlyIsCapped && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
                <div className="space-y-2">
                  <Label htmlFor="cappedHours">Capped Hours</Label>
                  <Input
                    id="cappedHours"
                    type="number"
                    step="0.25"
                    min="0"
                    placeholder="Maximum hours"
                    value={formData.cappedHours || 0}
                    onChange={(e) => setFormData({ ...formData, cappedHours: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cappedAmount">Capped Amount ({currencySymbol})</Label>
                  <Input
                    id="cappedAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Maximum amount"
                    value={formData.cappedAmount || 0}
                    onChange={(e) => setFormData({ ...formData, cappedAmount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="useBlendedRate"
                  checked={formData.useBlendedRate || false}
                  onChange={(e) => setFormData({ ...formData, useBlendedRate: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="useBlendedRate" className="cursor-pointer">
                  Use blended rate for all line items
                </Label>
              </div>
              {formData.useBlendedRate && (
                <div className="mt-2 ml-6 space-y-2">
                  <Label htmlFor="blendedRate">Blended Rate ({currencySymbol}/hr)</Label>
                  <Input
                    id="blendedRate"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Enter blended hourly rate"
                    value={formData.blendedRate || 0}
                    onChange={(e) => setFormData({ ...formData, blendedRate: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-gray-500">This rate will be applied to all line items when enabled</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export function RetainerConfig({ formData, setFormData, selectedCurrency, clientProjects = [], clientId }: MixedModelConfigsProps) {
  const currencySymbol = CURRENCIES[selectedCurrency.code] || selectedCurrency.symbol
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <Card className="border-l-4 border-l-purple-500">
      <CardHeader 
        className="cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Retainer Configuration</CardTitle>
            <CardDescription>Configure retainer amount, hours, duration, and payment terms</CardDescription>
          </div>
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="retainerMonthlyAmount">Monthly Retainer Amount ({currencySymbol}) *</Label>
              <Input
                id="retainerMonthlyAmount"
                type="number"
                step="0.01"
                min="0"
                value={formData.retainerMonthlyAmount || 0}
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
                value={formData.retainerHoursPerMonth || 0}
                onChange={(e) => setFormData({ ...formData, retainerHoursPerMonth: parseFloat(e.target.value) || 0 })}
                required
              />
              <p className="text-xs text-gray-500">Number of hours included in the monthly retainer</p>
            </div>
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
                {!clientId ? (
                  <p className="text-xs text-gray-500">Please select a client first</p>
                ) : clientProjects.length === 0 ? (
                  <p className="text-xs text-gray-500">No active projects found for this client</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-3">
                    {clientProjects.map((project) => (
                      <label key={project.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={formData.retainerProjectIds?.includes(project.id) || false}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, retainerProjectIds: [...(formData.retainerProjectIds || []), project.id] })
                            } else {
                              setFormData({ ...formData, retainerProjectIds: (formData.retainerProjectIds || []).filter((id: string) => id !== project.id) })
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
                <Label htmlFor="retainerAdditionalHoursRate">Fixed Hourly Rate ({currencySymbol}/hr) *</Label>
                <Input
                  id="retainerAdditionalHoursRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.retainerAdditionalHoursRate || 0}
                  onChange={(e) => setFormData({ ...formData, retainerAdditionalHoursRate: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
            )}
            
            {formData.retainerAdditionalHoursType === "RATE_RANGE" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="retainerAdditionalHoursRateMin">Minimum Rate ({currencySymbol}/hr) *</Label>
                  <Input
                    id="retainerAdditionalHoursRateMin"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.retainerAdditionalHoursRateMin || 0}
                    onChange={(e) => setFormData({ ...formData, retainerAdditionalHoursRateMin: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retainerAdditionalHoursRateMax">Maximum Rate ({currencySymbol}/hr) *</Label>
                  <Input
                    id="retainerAdditionalHoursRateMax"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.retainerAdditionalHoursRateMax || 0}
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
                        placeholder={`${currencySymbol}/hr`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <RetainerPaymentTerms
              currency={selectedCurrency.code}
              retainerUnusedBalancePolicy={formData.retainerUnusedBalancePolicy}
              retainerUnusedBalanceExpiryMonths={formData.retainerUnusedBalanceExpiryMonths}
              onUnusedBalancePolicyChange={(policy) => setFormData({ ...formData, retainerUnusedBalancePolicy: policy })}
              onUnusedBalanceExpiryMonthsChange={(months) => setFormData({ ...formData, retainerUnusedBalanceExpiryMonths: months })}
            />
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export function SuccessFeeConfig({ formData, setFormData, selectedCurrency }: MixedModelConfigsProps) {
  const currencySymbol = CURRENCIES[selectedCurrency.code] || selectedCurrency.symbol
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <Card className="border-l-4 border-l-orange-500">
      <CardHeader 
        className="cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Success Fee Configuration</CardTitle>
            <CardDescription>Configure the base fee and success fee structure</CardDescription>
          </div>
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </CardHeader>
      {isExpanded && (
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
                <Label htmlFor="successFeeBaseAmount">Base Fee Amount ({currencySymbol}) *</Label>
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
                  <Label htmlFor="successFeeBaseHourlyRate">Hourly Rate ({currencySymbol}/hr) *</Label>
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
                  <Label htmlFor="successFeeValue">Transaction/Deal Value ({currencySymbol}) *</Label>
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
                <Label htmlFor="successFeeAmount">Fixed Success Fee ({currencySymbol}) *</Label>
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
      )}
    </Card>
  )
}
