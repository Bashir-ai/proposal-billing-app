import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { notFound, redirect } from "next/navigation"
import { formatDate, formatCurrency } from "@/lib/utils"
import { ProposalStatus, ProposalType, ClientApprovalStatus } from "@prisma/client"
import Link from "next/link"
import { ApprovalButton } from "@/components/shared/ApprovalButton"
import { ProposalActions } from "@/components/proposals/ProposalActions"
import { ApproveOnBehalfButton } from "@/components/proposals/ApproveOnBehalfButton"
import { SendToClientButton } from "@/components/proposals/SendToClientButton"
import { CreateProjectButton } from "@/components/proposals/CreateProjectButton"
import { DownloadPdfButton } from "@/components/proposals/DownloadPdfButton"
import { SendProposalEmailButton } from "@/components/proposals/SendProposalEmailButton"
import { ViewProjectButton } from "@/components/proposals/ViewProjectButton"
import { GenerateUpfrontInvoiceButton } from "@/components/proposals/GenerateUpfrontInvoiceButton"
import { GenerateFirstRecurringInvoiceButton } from "@/components/proposals/GenerateFirstRecurringInvoiceButton"
import { canEditProposal, canApproveProposals, canDeleteItems } from "@/lib/permissions"
import { DeleteButton } from "@/components/shared/DeleteButton"
import { getLogoPath } from "@/lib/settings"
import Image from "next/image"

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
          milestones: {
            select: {
              id: true,
              name: true,
              description: true,
              amount: true,
              percent: true,
              dueDate: true,
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
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      bills: {
        where: {
          isUpfrontPayment: true,
        },
      },
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

  // Fetch logo
  const logoPath = await getLogoPath()

  // Fetch current user with permissions
  let currentUser = null
  let canEdit = false
  let canApprove = false
  let canResubmit = false
  let userApproval = null
  let isAdminOrManager = false
  let hasGeneralApprovalPermission = false
  let canStillApprove = true

  if (session?.user.id) {
    currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        canApproveProposals: true,
        canEditAllProposals: true,
      },
    })

    if (currentUser) {
      // Check edit permission using permission function
      canEdit = canEditProposal(currentUser, {
        createdBy: proposal.createdBy,
        status: proposal.status,
      })

      // Check approval permission
      // User has general approval permission (ADMIN/MANAGER or override)
      hasGeneralApprovalPermission = canApproveProposals(currentUser)
      
      // Check if user is in the required approvers list
      const isInRequiredApprovers = proposal.requiredApproverIds && 
        proposal.requiredApproverIds.length > 0 && 
        proposal.requiredApproverIds.includes(session.user.id)
      
      // ADMIN and MANAGER can approve even if they're the creator
      isAdminOrManager = currentUser.role === "ADMIN" || currentUser.role === "MANAGER"
      const isCreator = session.user.id === proposal.createdBy
      const canApproveOwnProposal = isAdminOrManager || !isCreator
      
      // Determine if user can approve based on internal approval requirements
      let canApproveInternal = false
      
      if (proposal.internalApprovalRequired) {
        // If internal approvals are required
        if (proposal.requiredApproverIds && proposal.requiredApproverIds.length > 0) {
          // Specific approvers are required - user must be in the list OR have general permission
          canApproveInternal = isInRequiredApprovers || hasGeneralApprovalPermission
        } else {
          // No specific approvers - anyone with general permission can approve
          canApproveInternal = hasGeneralApprovalPermission
        }
      } else {
        // No internal approvals required - anyone with general permission can approve
        canApproveInternal = hasGeneralApprovalPermission
      }
      
      // User can approve if:
      // 1. Proposal is submitted
      // 2. User is not a client
      // 3. User meets internal approval requirements
      // 4. User can approve own proposal (not creator OR is admin/manager)
      // Simplified: ADMIN/MANAGER can always approve submitted proposals
      if (proposal.status === ProposalStatus.SUBMITTED && session.user.role !== "CLIENT") {
        if (isAdminOrManager) {
          // ADMIN/MANAGER can approve any submitted proposal (including their own)
          canApprove = true
        } else {
          // Other users (STAFF with permission) can approve if:
          // - They have general approval permission
          // - They meet internal approval requirements
          // - They're not the creator (or have permission override)
          canApprove = hasGeneralApprovalPermission && canApproveInternal && canApproveOwnProposal
        }
      } else {
        canApprove = false
      }

      // Check if user already approved
      userApproval = proposal.approvals.find(
        (a) => a.approverId === session.user.id
      )
      
      // User can still approve if they have no approval OR if their approval is PENDING
      canStillApprove = !userApproval || userApproval.status === "PENDING"

      // Can resubmit if:
      // 1. Proposal is submitted AND user can edit, OR
      // 2. Proposal is submitted AND user can't edit AND user can't approve (needs to resubmit to get approval)
      canResubmit = proposal.status === ProposalStatus.SUBMITTED && 
        (canEdit || (!canEdit && !canApprove))
    }
  }

  const canSubmit = proposal.status === ProposalStatus.DRAFT && session?.user.role !== "CLIENT"
  const isClient = session?.user.role === "CLIENT"
  const hasProject = proposal.projects && proposal.projects.length > 0
  // Only admin can delete (soft delete to junk box)
  const canDelete = session?.user.role === "ADMIN" && 
    proposal.clientApprovalStatus !== "APPROVED" && 
    !proposal.deletedAt &&
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
      {/* Logo Header */}
      {logoPath && (
        <div className="mb-6 flex justify-start">
          <div className="relative h-20 w-auto">
            <Image
              src={logoPath}
              alt="Company Logo"
              width={200}
              height={80}
              className="object-contain h-20"
              style={{ maxHeight: "80px" }}
            />
          </div>
        </div>
      )}

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
          canApprove={canApprove}
          canResubmit={canResubmit}
          userApproval={userApproval}
          proposalStatus={proposal.status}
          currentUserRole={session?.user.role}
          canStillApprove={canStillApprove}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
          </CardHeader>
          <CardContent>
            {proposal.client ? (
              <>
            <p className="font-semibold">{proposal.client.name}</p>
            {proposal.client.company && (
              <p className="text-sm text-gray-600">{proposal.client.company}</p>
            )}
            {proposal.client.email && (
              <p className="text-sm text-gray-600">{proposal.client.email}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">No client assigned</p>
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
                      <>
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
                        {/* Display milestones for this line item */}
                        {item.milestones && item.milestones.length > 0 && (
                          <tr key={`${item.id}-milestones`} className="bg-gray-50">
                            <td colSpan={proposal.type === "MIXED_MODEL" ? 6 : (proposal.type === "HOURLY" || item.person) ? 5 : 4} className="p-2 pl-8">
                              <div className="flex flex-wrap gap-2 items-center">
                                <span className="text-xs font-semibold text-gray-600">Milestones:</span>
                                {item.milestones.map((milestone) => (
                                  <span
                                    key={milestone.id}
                                    className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 border border-blue-200"
                                  >
                                    {milestone.name}
                                    {milestone.percent && ` (${milestone.percent}%)`}
                                    {milestone.amount && !milestone.percent && ` (${currencySymbol}${milestone.amount.toFixed(2)})`}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
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

      {/* Internal Approval Status */}
      {proposal.internalApprovalRequired && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Internal Approval Status</CardTitle>
            <CardDescription>
              Approval requirement: {
                proposal.internalApprovalType === "ALL" ? "All selected must approve" :
                proposal.internalApprovalType === "ANY" ? "Any one approval sufficient" :
                proposal.internalApprovalType === "MAJORITY" ? "Majority must approve" :
                "Custom"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {proposal.internalApprovalsComplete ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded">
                <p className="font-semibold text-green-800">✓ All internal approvals complete</p>
                <p className="text-sm text-green-700 mt-1">
                  Proposal has been sent to client for approval
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="font-semibold text-yellow-800">⏳ Waiting for internal approvals</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    {proposal.requiredApproverIds?.length || 0} team member{proposal.requiredApproverIds?.length !== 1 ? "s" : ""} selected
                  </p>
                </div>
                {proposal.approvals && proposal.approvals.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Approval Progress:</p>
                    {proposal.approvals
                      .filter(a => proposal.requiredApproverIds?.includes(a.approverId))
                      .map((approval) => (
                        <div key={approval.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div>
                            <span className="font-medium">{approval.approver.name}</span>
                            <span className="text-sm text-gray-500 ml-2">({approval.approver.email})</span>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            approval.status === "APPROVED" 
                              ? "bg-green-100 text-green-800"
                              : approval.status === "REJECTED"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {approval.status}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Internal Approval Button (for any user who can approve) */}
      {proposal.status === ProposalStatus.SUBMITTED && 
       canApprove &&
       canStillApprove && (
        <Card className="mb-8 border-green-300 bg-green-50">
          <CardHeader>
            <CardTitle>Your Approval Required</CardTitle>
            <CardDescription>
              {proposal.requiredApproverIds?.includes(session?.user.id || "")
                ? "You have been selected to approve this proposal"
                : "Review and approve this proposal"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApprovalButton
              proposalId={proposal.id}
              currentUserRole={session?.user.role || "CLIENT"}
            />
          </CardContent>
        </Card>
      )}

      {/* Client Approval Status */}
      {proposal.internalApprovalsComplete && proposal.clientApprovalStatus === ClientApprovalStatus.PENDING && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Client Approval</CardTitle>
            <CardDescription>
              {proposal.clientApprovalEmailSent 
                ? "Approval email has been sent to the client"
                : "Waiting for client approval email to be sent"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="font-semibold text-blue-800">Status: Pending Client Approval</p>
              {proposal.client?.email && (
                <p className="text-sm text-blue-700 mt-1">
                  Email sent to: {proposal.client.email}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Proposal Actions: PDF, Send Email, Create Project */}
      {proposal.internalApprovalsComplete && session?.user.role !== "CLIENT" && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Proposal Actions</CardTitle>
            <CardDescription>Download PDF, send to client, or create project</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {/* Download PDF Button */}
              <DownloadPdfButton proposalId={proposal.id} />

              {/* Send Proposal Email Button */}
              {proposal.client?.email && (
                <SendProposalEmailButton proposalId={proposal.id} />
              )}

              {/* Send to Client Button */}
              {!proposal.clientApprovalEmailSent && (
                <SendToClientButton proposalId={proposal.id} />
              )}

              {/* Generate Upfront Payment Invoice Button */}
              {proposal.clientApprovalStatus === ClientApprovalStatus.APPROVED && 
               proposal.paymentTerms.some(pt => pt.upfrontType && pt.upfrontValue) &&
               proposal.bills.length === 0 && (
                <GenerateUpfrontInvoiceButton proposalId={proposal.id} />
              )}

              {/* Generate First Recurring Invoice Button */}
              {proposal.status === ProposalStatus.APPROVED && 
               !proposal.lastRecurringInvoiceDate && 
               (proposal.recurringEnabled || proposal.items.some(item => item.billingMethod === "RECURRING" && item.recurringEnabled)) && (
                <GenerateFirstRecurringInvoiceButton proposalId={proposal.id} />
              )}

              {/* Create Project Button */}
              {proposal.status === ProposalStatus.APPROVED && !hasProject && (
                <CreateProjectButton proposalId={proposal.id} />
              )}

              {/* View Project Link */}
              {hasProject && proposal.projects && proposal.projects.length > 0 && (
                <ViewProjectButton projectId={proposal.projects[0].id} />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Override Button - Available for any client approval status */}
      {proposal.internalApprovalsComplete &&
       (session?.user.role === "ADMIN" || session?.user.role === "MANAGER") && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Override Client Approval</CardTitle>
            <CardDescription>
              As an administrator or manager, you can approve or reject this proposal on behalf of the client.
              Current status: {proposal.clientApprovalStatus}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApproveOnBehalfButton proposalId={proposal.id} />
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
