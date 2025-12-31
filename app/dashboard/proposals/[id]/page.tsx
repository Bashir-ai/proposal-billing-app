import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { notFound, redirect } from "next/navigation"
import { formatDate, formatCurrency } from "@/lib/utils"
import { ProposalStatus, ProposalType, ClientApprovalStatus } from "@prisma/client"
import Link from "next/link"
import { ApprovalButton } from "@/components/shared/ApprovalButton"
import { ProposalActions } from "@/components/proposals/ProposalActions"

async function submitProposal(formData: FormData) {
  "use server"
  const proposalId = formData.get("proposalId") as string
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  
  await prisma.proposal.update({
    where: { id: proposalId },
    data: {
      status: ProposalStatus.SUBMITTED,
      submittedAt: new Date(),
    },
  })
  
  redirect(`/dashboard/proposals/${proposalId}`)
}

const CURRENCIES: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
}

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: {
      client: true,
      creator: {
        select: {
          name: true,
          email: true,
        },
      },
      items: {
        include: {
          person: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      milestones: {
        orderBy: { createdAt: "asc" },
      },
      tags: true,
      paymentTerms: true,
      approvals: {
        include: {
          approver: {
            select: {
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      bills: true,
      projects: {
        select: {
          id: true,
        },
      },
    },
  })

  if (!proposal) {
    notFound()
  }

  // Check if client can access this proposal
  if (session?.user.role === "CLIENT") {
    const client = await prisma.client.findFirst({
      where: { email: session.user.email },
    })
    if (!client || proposal.clientId !== client.id) {
      return <div>Access denied</div>
    }
  }

  const getStatusColor = (status: ProposalStatus) => {
    switch (status) {
      case "DRAFT":
        return "bg-gray-100 text-gray-800"
      case "SUBMITTED":
        return "bg-blue-100 text-blue-800"
      case "APPROVED":
        return "bg-green-100 text-green-800"
      case "REJECTED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getTypeLabel = (type: ProposalType) => {
    switch (type) {
      case "FIXED_FEE":
        return "Fixed Fee"
      case "HOURLY":
        return "Hourly"
      case "RETAINER":
        return "Retainer"
      case "SUCCESS_FEE":
        return "Success Fee"
      case "MIXED_MODEL":
        return "Mixed Model"
      case "CAPPED_FEE":
        return "Capped Fee" // Legacy - kept for backward compatibility
      case "LUMP_SUM":
        return "Lump Sum" // Legacy - kept for backward compatibility
      case "SUBJECT_BASIS":
        return "Subject Basis" // Legacy - kept for backward compatibility
      default:
        return type
    }
  }

  const currencySymbol = CURRENCIES[proposal.currency] || proposal.currency

  // Calculate totals
  const calculateSubtotal = () => {
    return proposal.items.reduce((sum, item) => sum + item.amount, 0)
  }

  const calculateClientDiscount = () => {
    const subtotal = calculateSubtotal()
    if (proposal.clientDiscountPercent) {
      return subtotal * (proposal.clientDiscountPercent / 100)
    } else if (proposal.clientDiscountAmount) {
      return proposal.clientDiscountAmount
    }
    return 0
  }

  const calculateTax = () => {
    if (!proposal.taxRate || proposal.taxRate === 0) return 0
    const subtotal = calculateSubtotal()
    const afterDiscount = subtotal - calculateClientDiscount()
    
    if (proposal.taxInclusive) {
      return afterDiscount * (proposal.taxRate / (100 + proposal.taxRate))
    } else {
      return afterDiscount * (proposal.taxRate / 100)
    }
  }

  const calculateGrandTotal = () => {
    const subtotal = calculateSubtotal()
    const discount = calculateClientDiscount()
    const tax = calculateTax()
    const afterDiscount = subtotal - discount
    
    if (proposal.taxInclusive) {
      return afterDiscount
    } else {
      return afterDiscount + tax
    }
  }

  const subtotal = calculateSubtotal()
  const clientDiscount = calculateClientDiscount()
  const tax = calculateTax()
  const grandTotal = calculateGrandTotal()

  const canEdit = proposal.status === ProposalStatus.DRAFT && 
    (session?.user.role !== "CLIENT" && proposal.createdBy === session?.user.id)
  const canSubmit = proposal.status === ProposalStatus.DRAFT && session?.user.role !== "CLIENT"
  const isClient = session?.user.role === "CLIENT"
  const hasProject = proposal.projects && proposal.projects.length > 0
  // Anyone can delete a proposal that hasn't been accepted by the client
  const canDelete = proposal.clientApprovalStatus !== "APPROVED" && 
    !proposal.deletedAt &&
    (session?.user.role === "ADMIN" || proposal.createdBy === session?.user.id) &&
    (!proposal.projects || proposal.projects.length === 0)

  const getClientApprovalColor = (status: ClientApprovalStatus) => {
    switch (status) {
      case "APPROVED":
        return "bg-green-100 text-green-800"
      case "REJECTED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-yellow-100 text-yellow-800"
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            {proposal.proposalNumber && (
              <span className="text-sm text-gray-600">Proposal #{proposal.proposalNumber}</span>
            )}
          </div>
          <h1 className="text-3xl font-bold">{proposal.title}</h1>
          <div className="flex items-center space-x-2 mt-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(proposal.status)}`}>
              {proposal.status}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getClientApprovalColor(proposal.clientApprovalStatus)}`}>
              Client: {proposal.clientApprovalStatus}
            </span>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              {getTypeLabel(proposal.type)}
            </span>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {proposal.currency}
            </span>
            {proposal.tags && proposal.tags.length > 0 && (
              <>
                {proposal.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="px-2 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: tag.color ? `${tag.color}20` : "#3B82F620",
                      color: tag.color || "#3B82F6",
                    }}
                  >
                    {tag.name}
                  </span>
                ))}
              </>
            )}
            {proposal.customTags && proposal.customTags.length > 0 && (
              <>
                {proposal.customTags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                  >
                    {tag}
                  </span>
                ))}
              </>
            )}
          </div>
        </div>
        <ProposalActions
          proposalId={proposal.id}
          canEdit={canEdit}
          canSubmit={canSubmit}
          isClient={isClient}
          clientApprovalStatus={proposal.clientApprovalStatus}
          hasProject={hasProject}
          canDelete={canDelete}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{proposal.client.name}</p>
            {proposal.client.company && (
              <p className="text-sm text-gray-600">{proposal.client.company}</p>
            )}
            {proposal.client.email && (
              <p className="text-sm text-gray-600">{proposal.client.email}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Proposal Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {proposal.proposalNumber && (
              <div>
                <span className="text-sm text-gray-600">Proposal Number: </span>
                <span className="font-semibold">{proposal.proposalNumber}</span>
              </div>
            )}
            {proposal.issueDate && (
              <div>
                <span className="text-sm text-gray-600">Issue Date: </span>
                <span>{formatDate(proposal.issueDate)}</span>
              </div>
            )}
            {proposal.expiryDate && (
              <div>
                <span className="text-sm text-gray-600">Expiry Date: </span>
                <span>{formatDate(proposal.expiryDate)}</span>
                {new Date(proposal.expiryDate) < new Date() && (
                  <span className="ml-2 text-red-600 text-xs">(Expired)</span>
                )}
              </div>
            )}
            <div>
              <span className="text-sm text-gray-600">Currency: </span>
              <span>{proposal.currency}</span>
            </div>
            {proposal.taxRate && proposal.taxRate > 0 && (
              <div>
                <span className="text-sm text-gray-600">Tax: </span>
                <span>{proposal.taxRate}% {proposal.taxInclusive ? "(Inclusive)" : "(Exclusive)"}</span>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-600">Created by: </span>
              <span>{proposal.creator.name}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Created: </span>
              <span>{formatDate(proposal.createdAt)}</span>
            </div>
            {proposal.submittedAt && (
              <div>
                <span className="text-sm text-gray-600">Submitted: </span>
                <span>{formatDate(proposal.submittedAt)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Billing Method Specific Details */}
      {/* Payment Terms Section */}
      {proposal.paymentTerms && proposal.paymentTerms.length > 0 && (() => {
        // Get proposal-level payment term (first one without proposalItemId)
        const proposalPaymentTerm = proposal.paymentTerms.find(pt => !pt.proposalItemId)
        
        if (!proposalPaymentTerm) return null
        
        const { upfrontType, upfrontValue, installmentType, installmentCount, installmentFrequency, milestoneIds } = proposalPaymentTerm
        
        // Get milestone names for milestone-based payments
        const milestoneNames = milestoneIds && milestoneIds.length > 0 && proposal.milestones
          ? proposal.milestones
              .filter(m => milestoneIds.includes(m.id))
              .map(m => m.name)
          : []
        
        return (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Payment Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Upfront Payment */}
                {upfrontType && upfrontValue !== null && upfrontValue !== undefined && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                    <h4 className="font-semibold text-blue-900 mb-2">Upfront Payment</h4>
                    <p className="text-lg">
                      {upfrontType === "PERCENT" 
                        ? `${upfrontValue}% upfront`
                        : `${currencySymbol}${upfrontValue.toFixed(2)} upfront`
                      }
                    </p>
                  </div>
                )}
                
                {/* Remaining Payment Schedule */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded">
                  <h4 className="font-semibold text-gray-900 mb-2">Remaining Payment Schedule</h4>
                  {installmentType === "TIME_BASED" && installmentCount && installmentFrequency ? (
                    <div>
                      <p className="text-lg">
                        Remaining balance in <strong>{installmentCount}</strong> {installmentFrequency.toLowerCase()} installments
                      </p>
                      {installmentFrequency === "WEEKLY" && (
                        <p className="text-sm text-gray-600 mt-1">Payments due weekly</p>
                      )}
                      {installmentFrequency === "MONTHLY" && (
                        <p className="text-sm text-gray-600 mt-1">Payments due monthly</p>
                      )}
                      {installmentFrequency === "QUARTERLY" && (
                        <p className="text-sm text-gray-600 mt-1">Payments due quarterly</p>
                      )}
                    </div>
                  ) : installmentType === "MILESTONE_BASED" && milestoneNames.length > 0 ? (
                    <div>
                      <p className="text-lg mb-2">Remaining balance due upon completion of milestones:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {milestoneNames.map((name, index) => (
                          <li key={index} className="text-gray-700">{name}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-lg">Balance due upon completion of work</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {proposal.type === "HOURLY" && (proposal.estimatedHours || proposal.hourlyRateRangeMin || proposal.hourlyRateRangeMax || proposal.hourlyCapHours) && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Hourly Rate Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {proposal.estimatedHours && (
              <div>
                <span className="text-sm text-gray-600">Estimated Hours: </span>
                <span>{proposal.estimatedHours}</span>
              </div>
            )}
            {proposal.hourlyCapHours && (
              <div>
                <span className="text-sm text-gray-600">Maximum Hours Cap: </span>
                <span className="font-semibold">{proposal.hourlyCapHours} hours</span>
              </div>
            )}
            {(proposal.hourlyRateRangeMin || proposal.hourlyRateRangeMax) && (
              <div>
                <span className="text-sm text-gray-600">Rate Range: </span>
                <span>
                  {currencySymbol}{proposal.hourlyRateRangeMin || 0}/hr - {currencySymbol}{proposal.hourlyRateRangeMax || 0}/hr
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {proposal.type === "RETAINER" && (proposal.retainerMonthlyAmount || proposal.retainerHourlyCap) && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Retainer Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {proposal.retainerMonthlyAmount && (
              <div>
                <span className="text-sm text-gray-600">Monthly Amount: </span>
                <span className="font-semibold">{currencySymbol}{proposal.retainerMonthlyAmount.toFixed(2)}</span>
              </div>
            )}
            {proposal.retainerHourlyCap && (
              <div>
                <span className="text-sm text-gray-600">Hourly Cap: </span>
                <span className="font-semibold">{currencySymbol}{proposal.retainerHourlyCap.toFixed(2)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {proposal.useBlendedRate && proposal.blendedRate && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Blended Rate Option</CardTitle>
            <CardDescription>Single rate applied to all line items</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{currencySymbol}{proposal.blendedRate.toFixed(2)}/hr</p>
          </CardContent>
        </Card>
      )}

      {proposal.type === "SUCCESS_FEE" && (proposal.successFeePercent || proposal.successFeeAmount || proposal.successFeeValue) && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Success Fee Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {proposal.successFeePercent && (
              <div>
                <span className="text-sm text-gray-600">Success Fee Percentage: </span>
                <span>{proposal.successFeePercent}%</span>
              </div>
            )}
            {proposal.successFeeAmount && (
              <div>
                <span className="text-sm text-gray-600">Fixed Success Fee: </span>
                <span className="font-semibold">{currencySymbol}{proposal.successFeeAmount.toFixed(2)}</span>
              </div>
            )}
            {proposal.successFeeValue && (
              <div>
                <span className="text-sm text-gray-600">Transaction/Deal Value: </span>
                <span className="font-semibold">{currencySymbol}{proposal.successFeeValue.toFixed(2)}</span>
              </div>
            )}
            {proposal.successFeePercent && proposal.successFeeValue && (
              <div className="pt-2 border-t">
                <span className="text-sm text-gray-600">Calculated Fee: </span>
                <span className="font-semibold text-lg">
                  {currencySymbol}{(proposal.successFeeValue * proposal.successFeePercent / 100).toFixed(2)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {proposal.type === "MIXED_MODEL" && (proposal.fixedAmount || proposal.outOfScopeHourlyRate) && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Mixed Model Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {proposal.fixedAmount && (
              <div>
                <span className="text-sm text-gray-600">Fixed Amount: </span>
                <span className="font-semibold">{currencySymbol}{proposal.fixedAmount.toFixed(2)}</span>
              </div>
            )}
            {proposal.outOfScopeHourlyRate && (
              <div>
                <span className="text-sm text-gray-600">Out-of-Scope Hourly Rate: </span>
                <span className="font-semibold">{currencySymbol}{proposal.outOfScopeHourlyRate.toFixed(2)}/hr</span>
      </div>
            )}
          </CardContent>
        </Card>
      )}

      {proposal.description && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{proposal.description}</p>
          </CardContent>
        </Card>
      )}

      {proposal.items.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    {proposal.type === "MIXED_MODEL" && <th className="text-left p-2">Billing Method</th>}
                    {(proposal.type === "HOURLY" || proposal.type === "MIXED_MODEL") && <th className="text-left p-2">Person</th>}
                    <th className="text-left p-2">Description</th>
                    <th className="text-right p-2">Quantity</th>
                    <th className="text-right p-2">Unit Price</th>
                    <th className="text-right p-2">Discount</th>
                    <th className="text-right p-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.items.map((item) => {
                    const lineDiscount = item.discountPercent 
                      ? (item.amount / (1 - item.discountPercent / 100)) * (item.discountPercent / 100)
                      : item.discountAmount || 0
                    const lineSubtotal = item.amount + lineDiscount
                    
                    return (
                    <tr key={item.id} className="border-b">
                        {proposal.type === "MIXED_MODEL" && (
                          <td className="p-2">
                            <span className="px-2 py-1 rounded text-xs bg-gray-100">
                              {item.billingMethod === "hourly" ? "Hourly" : "Fixed"}
                            </span>
                          </td>
                        )}
                        {(proposal.type === "HOURLY" || proposal.type === "MIXED_MODEL") && item.person && (
                          <td className="p-2">{item.person.name}</td>
                      )}
                      <td className="p-2">{item.description}</td>
                        <td className="p-2 text-right">{item.quantity || "-"}</td>
                        <td className="p-2 text-right">
                          {item.rate ? `${currencySymbol}${item.rate.toFixed(2)}/hr` : item.unitPrice ? `${currencySymbol}${item.unitPrice.toFixed(2)}` : "-"}
                        </td>
                        <td className="p-2 text-right text-sm text-gray-600">
                          {item.discountPercent ? `${item.discountPercent}%` : item.discountAmount ? `${currencySymbol}${item.discountAmount.toFixed(2)}` : "-"}
                        </td>
                        <td className="p-2 text-right font-semibold">{currencySymbol}{item.amount.toFixed(2)}</td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-semibold">{currencySymbol}{subtotal.toFixed(2)}</span>
            </div>
            {clientDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Client Discount:</span>
                <span>-{currencySymbol}{clientDiscount.toFixed(2)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between">
                <span>Tax ({proposal.taxRate}%):</span>
                <span>{currencySymbol}{tax.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Grand Total:</span>
              <span>{currencySymbol}{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {proposal.status === ProposalStatus.SUBMITTED && 
       session?.user.role !== "CLIENT" && 
       session?.user.id !== proposal.createdBy && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <ApprovalButton
              proposalId={proposal.id}
              currentUserRole={session?.user.role || "CLIENT"}
            />
          </CardContent>
        </Card>
      )}

      {proposal.approvals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Approval History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {proposal.approvals.map((approval) => (
                <div key={approval.id} className="border-l-4 pl-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{approval.approver.name}</p>
                      <p className="text-sm text-gray-600">{approval.approver.role}</p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        approval.status === "APPROVED" 
                          ? "bg-green-100 text-green-800"
                          : approval.status === "REJECTED"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {approval.status}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(approval.createdAt)}
                      </p>
                    </div>
                  </div>
                  {approval.comments && (
                    <p className="text-sm text-gray-600 mt-2">{approval.comments}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
