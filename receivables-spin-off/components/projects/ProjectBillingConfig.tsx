"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Plus, X, Trash2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { PROFILE_LABELS } from "@/lib/proposal-billing-rates"
import { UserProfile } from "@prisma/client"

const CURRENCIES: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
}

interface ProjectBillingConfigProps {
  projectId: string
  formData: {
    currency: string
    useBlendedRate: boolean
    blendedRate: number
    hourlyRateTableType: string | null
    hourlyRateTableRates: any
    hourlyRateRangeMin: number
    hourlyRateRangeMax: number
  }
  setFormData: (data: any) => void
  userRates: Array<{ userId: string; rate: number }>
  setUserRates: (rates: Array<{ userId: string; rate: number }>) => void
  users: Array<{
    id: string
    name: string
    email: string
    profile: string | null
    defaultHourlyRate: number | null
  }>
  proposal: {
    type: string
    useBlendedRate?: boolean | null
    blendedRate?: number | null
    hourlyRateTableType?: string | null
    hourlyRateTableRates?: any
    hourlyRateRangeMin?: number | null
    hourlyRateRangeMax?: number | null
  } | null
  onSave: (e: React.FormEvent) => Promise<void>
  loading: boolean
}

export function ProjectBillingConfig({
  projectId,
  formData,
  setFormData,
  userRates,
  setUserRates,
  users,
  proposal,
  onSave,
  loading,
}: ProjectBillingConfigProps) {
  const currencySymbol = CURRENCIES[formData.currency] || formData.currency
  const [newUserRate, setNewUserRate] = useState({ userId: "", rate: 0 })

  // Get users not already in userRates
  const availableUsers = users.filter(
    (user) => !userRates.some((ur) => ur.userId === user.id)
  )

  const handleAddUserRate = () => {
    if (!newUserRate.userId || newUserRate.rate <= 0) {
      return
    }
    setUserRates([...userRates, { ...newUserRate }])
    setNewUserRate({ userId: "", rate: 0 })
  }

  const handleRemoveUserRate = (userId: string) => {
    setUserRates(userRates.filter((ur) => ur.userId !== userId))
  }

  const handleUpdateUserRate = (userId: string, rate: number) => {
    setUserRates(
      userRates.map((ur) => (ur.userId === userId ? { ...ur, rate } : ur))
    )
  }

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId)
    return user ? `${user.name} (${user.email})` : "Unknown User"
  }

  const getUserProfile = (userId: string) => {
    const user = users.find((u) => u.id === userId)
    return user?.profile ? PROFILE_LABELS[user.profile as UserProfile] : "N/A"
  }

  const getUserDefaultRate = (userId: string) => {
    const user = users.find((u) => u.id === userId)
    return user?.defaultHourlyRate || 0
  }

  return (
    <form onSubmit={onSave} className="space-y-6">
      {/* Blended Rate Section */}
      <Card>
        <CardHeader>
          <CardTitle>Blended Rate</CardTitle>
          <CardDescription>
            Use a single blended rate for all users in this project
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="useBlendedRate"
              checked={formData.useBlendedRate}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  useBlendedRate: e.target.checked,
                  blendedRate: e.target.checked ? formData.blendedRate : 0,
                })
              }}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="useBlendedRate" className="cursor-pointer">
              Use blended rate for this project
            </Label>
          </div>

          {formData.useBlendedRate && (
            <div className="space-y-2">
              <Label htmlFor="blendedRate">Blended Rate ({currencySymbol}/hr)</Label>
              <Input
                id="blendedRate"
                type="number"
                step="0.01"
                min="0"
                value={formData.blendedRate || 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    blendedRate: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="Enter blended rate"
              />
              {proposal?.useBlendedRate && proposal?.blendedRate && (
                <p className="text-xs text-gray-500">
                  Proposal blended rate: {formatCurrency(proposal.blendedRate, formData.currency)}/hr
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hourly Rate Table Section */}
      {!formData.useBlendedRate && (
        <Card>
          <CardHeader>
            <CardTitle>Hourly Rate Configuration</CardTitle>
            <CardDescription>
              Configure hourly rates by user profile or rate range
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-base font-semibold mb-3 block">
                Rate Configuration Type
              </Label>
              <div className="space-y-3">
                <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="hourlyRateTableType"
                    value="RATE_RANGE"
                    checked={formData.hourlyRateTableType === "RATE_RANGE"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hourlyRateTableType: e.target.value,
                      })
                    }
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Rate Range</div>
                    <div className="text-sm text-gray-600">
                      Use a min/max rate range (average will be used)
                    </div>
                  </div>
                </label>

                <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="hourlyRateTableType"
                    value="HOURLY_TABLE"
                    checked={formData.hourlyRateTableType === "HOURLY_TABLE"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hourlyRateTableType: e.target.value,
                        hourlyRateTableRates: formData.hourlyRateTableRates || {},
                      })
                    }
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Hourly Table by Profile</div>
                    <div className="text-sm text-gray-600">
                      Charge different rates based on user profile
                    </div>
                  </div>
                </label>

                <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="hourlyRateTableType"
                    value=""
                    checked={!formData.hourlyRateTableType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hourlyRateTableType: null,
                      })
                    }
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Use Proposal Settings</div>
                    <div className="text-sm text-gray-600">
                      Fall back to proposal billing configuration
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {formData.hourlyRateTableType === "RATE_RANGE" && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="hourlyRateRangeMin">
                    Min Rate ({currencySymbol}/hr)
                  </Label>
                  <Input
                    id="hourlyRateRangeMin"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.hourlyRateRangeMin || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hourlyRateRangeMin: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hourlyRateRangeMax">
                    Max Rate ({currencySymbol}/hr)
                  </Label>
                  <Input
                    id="hourlyRateRangeMax"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.hourlyRateRangeMax || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hourlyRateRangeMax: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                {(formData.hourlyRateRangeMin || 0) > 0 &&
                  (formData.hourlyRateRangeMax || 0) > 0 && (
                    <div className="col-span-2 text-sm text-gray-600">
                      Average rate:{" "}
                      {formatCurrency(
                        ((formData.hourlyRateRangeMin || 0) +
                          (formData.hourlyRateRangeMax || 0)) /
                          2,
                        formData.currency
                      )}
                      /hr
                    </div>
                  )}
              </div>
            )}

            {formData.hourlyRateTableType === "HOURLY_TABLE" && (
              <div className="space-y-4 pt-4 border-t">
                <Label className="text-base font-semibold">
                  Hourly Rates by Profile
                </Label>
                <div className="space-y-2">
                  {Object.entries(PROFILE_LABELS).map(([key, label]) => (
                    <div key={key} className="grid grid-cols-2 gap-4 items-center">
                      <Label>{label}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={
                          formData.hourlyRateTableRates?.[key] || 0
                        }
                        onChange={(e) => {
                          const newRates = {
                            ...(formData.hourlyRateTableRates || {}),
                            [key]: parseFloat(e.target.value) || 0,
                          }
                          setFormData({
                            ...formData,
                            hourlyRateTableRates: newRates,
                          })
                        }}
                        placeholder={`${currencySymbol}/hr`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Individual User Rates Section */}
      <Card>
        <CardHeader>
          <CardTitle>Individual User Rate Overrides</CardTitle>
          <CardDescription>
            Set specific hourly rates for individual users (takes highest priority)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new user rate */}
          {availableUsers.length > 0 && (
            <div className="p-4 bg-gray-50 rounded-lg border">
              <Label className="text-sm font-semibold mb-2 block">
                Add User Rate Override
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <Select
                    value={newUserRate.userId}
                    onChange={(e) =>
                      setNewUserRate({ ...newUserRate, userId: e.target.value })
                    }
                  >
                    <option value="">Select user...</option>
                    {availableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email}) - Default:{" "}
                        {user.defaultHourlyRate
                          ? formatCurrency(user.defaultHourlyRate, formData.currency)
                          : "N/A"}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={`${currencySymbol}/hr`}
                    value={newUserRate.rate || ""}
                    onChange={(e) =>
                      setNewUserRate({
                        ...newUserRate,
                        rate: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
              <Button
                type="button"
                onClick={handleAddUserRate}
                disabled={!newUserRate.userId || newUserRate.rate <= 0}
                size="sm"
                className="mt-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Rate
              </Button>
            </div>
          )}

          {/* User rates list */}
          {userRates.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No individual user rate overrides set
            </p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-4 text-sm font-semibold pb-2 border-b">
                <div className="col-span-4">User</div>
                <div className="col-span-2">Profile</div>
                <div className="col-span-2">Default Rate</div>
                <div className="col-span-3">Override Rate</div>
                <div className="col-span-1">Actions</div>
              </div>
              {userRates.map((userRate) => (
                <div
                  key={userRate.userId}
                  className="grid grid-cols-12 gap-4 items-center py-2 border-b"
                >
                  <div className="col-span-4 text-sm">{getUserName(userRate.userId)}</div>
                  <div className="col-span-2 text-sm text-gray-600">
                    {getUserProfile(userRate.userId)}
                  </div>
                  <div className="col-span-2 text-sm text-gray-600">
                    {getUserDefaultRate(userRate.userId)
                      ? formatCurrency(
                          getUserDefaultRate(userRate.userId),
                          formData.currency
                        )
                      : "N/A"}
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={userRate.rate}
                      onChange={(e) =>
                        handleUpdateUserRate(
                          userRate.userId,
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full"
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveUserRate(userRate.userId)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Billing Configuration"}
        </Button>
      </div>
    </form>
  )
}
