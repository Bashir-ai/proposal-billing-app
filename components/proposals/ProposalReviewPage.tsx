"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { CheckCircle2, XCircle, Download, AlertCircle } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

interface ProposalReviewPageProps {
  proposal: {
    id: string
    title: string
    description: string | null
    proposalNumber: string | null
    status: string
    clientApprovalStatus: string
    amount: number | null
    currency: string
    currencySymbol: string
    issueDate: Date | null
    expiryDate: Date | null
    createdAt: Date
    client: {
      id: string
      name: string
      company: string | null
      email: string | null
    } | null
    lead: {
      id: string
      name: string
      company: string | null
      email: string | null
    } | null
    creator: {
      name: string
      email: string
    }
    items: Array<{
      id: string
      description: string
      quantity: number | null
      rate: number | null
      amount: number
    }>
    milestones: Array<{
      id: string
      name: string
      description: string | null
      amount: number | null
      percent: number | null
      dueDate: Date | null
    }>
    tags: Array<{
      id: string
      name: string
      color: string | null
    }>
  }
  token: string
}

export function ProposalReviewPage({ proposal, token }: ProposalReviewPageProps) {
  const [action, setAction] = useState<"approve" | "reject" | null>(null)
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleApprove = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/proposals/${proposal.id}/client-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          action: "approve",
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to approve proposal")
      }

      setSuccess(true)
      setAction("approve")
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/proposals/${proposal.id}/client-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          action: "reject",
          reason: reason.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to reject proposal")
      }

      setSuccess(true)
      setAction("reject")
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const recipient = proposal.client || proposal.lead
  const recipientType = proposal.client ? "Client" : "Lead"

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className={`mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center ${action === "approve" ? "bg-green-100" : "bg-red-100"}`}>
              {action === "approve" ? (
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              ) : (
                <XCircle className="w-8 h-8 text-red-600" />
              )}
            </div>
            <h1 className="text-2xl font-bold mb-4">
              Proposal {action === "approve" ? "Approved" : "Rejected"}
            </h1>
            <p className="text-gray-600 mb-6">
              Thank you for your response. The proposal has been {action === "approve" ? "approved" : "rejected"}.
            </p>
            {action === "reject" && reason && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm font-medium text-gray-700 mb-2">Your reason:</p>
                <p className="text-sm text-gray-600">{reason}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl mb-2">{proposal.title}</CardTitle>
                {proposal.proposalNumber && (
                  <p className="text-sm text-gray-600">Proposal #{proposal.proposalNumber}</p>
                )}
              </div>
              <a
                href={`/api/proposals/${proposal.id}/pdf?token=${token}`}
                target="_blank"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </a>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Proposal Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">{recipientType}</p>
                <p className="text-gray-900">{recipient?.name}</p>
                {recipient?.company && (
                  <p className="text-sm text-gray-600">{recipient.company}</p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Created by</p>
                <p className="text-gray-900">{proposal.creator.name}</p>
              </div>
              {proposal.issueDate && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Issue Date</p>
                  <p className="text-gray-900">{formatDate(proposal.issueDate)}</p>
                </div>
              )}
              {proposal.expiryDate && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Expiry Date</p>
                  <p className="text-gray-900">{formatDate(proposal.expiryDate)}</p>
                </div>
              )}
            </div>

            {proposal.description && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Description</p>
                <p className="text-gray-900 whitespace-pre-wrap">{proposal.description}</p>
              </div>
            )}

            {/* Proposal Items */}
            {proposal.items.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Items</p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Description</th>
                        {proposal.items.some(item => item.quantity) && (
                          <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Qty</th>
                        )}
                        {proposal.items.some(item => item.rate) && (
                          <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Rate</th>
                        )}
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {proposal.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                          {proposal.items.some(i => i.quantity) && (
                            <td className="px-4 py-3 text-sm text-right text-gray-600">{item.quantity || "-"}</td>
                          )}
                          {proposal.items.some(i => i.rate) && (
                            <td className="px-4 py-3 text-sm text-right text-gray-600">
                              {item.rate ? `${proposal.currencySymbol}${item.rate.toFixed(2)}` : "-"}
                            </td>
                          )}
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                            {formatCurrency(item.amount, proposal.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {proposal.amount && (
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={proposal.items.some(i => i.quantity) && proposal.items.some(i => i.rate) ? 3 : proposal.items.some(i => i.quantity) || proposal.items.some(i => i.rate) ? 2 : 1} className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                            Total:
                          </td>
                          <td className="px-4 py-3 text-right text-lg font-bold text-gray-900">
                            {formatCurrency(proposal.amount, proposal.currency)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Approval Actions */}
            <div className="border-t pt-6 space-y-4">
              <div>
                <Label htmlFor="rejectionReason" className="mb-2">
                  Rejection Reason (optional)
                </Label>
                <Textarea
                  id="rejectionReason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please provide a reason if rejecting..."
                  rows={3}
                  className="mb-4"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={handleApprove}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  size="lg"
                >
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  {loading ? "Processing..." : "Approve Proposal"}
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={loading}
                  variant="destructive"
                  className="flex-1"
                  size="lg"
                >
                  <XCircle className="w-5 h-5 mr-2" />
                  {loading ? "Processing..." : "Reject Proposal"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
