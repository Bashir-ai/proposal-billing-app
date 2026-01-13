import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { notFound, redirect } from "next/navigation"
import { formatDate, formatCurrency } from "@/lib/utils"
import { BillStatus } from "@prisma/client"
import Link from "next/link"
import { ApprovalButton } from "@/components/shared/ApprovalButton"
import { SubmitInvoiceButton } from "@/components/invoices/SubmitInvoiceButton"
import { canEditInvoice, canApproveInvoices, canDeleteItems } from "@/lib/permissions"
import { DeleteButton } from "@/components/shared/DeleteButton"
import { OutstandingInvoiceAlert } from "@/components/invoices/OutstandingInvoiceAlert"
import { DownloadPdfButton } from "@/components/invoices/DownloadPdfButton"
import { SendInvoiceEmailButton } from "@/components/invoices/SendInvoiceEmailButton"
import { SendPaymentReminderButton } from "@/components/invoices/SendPaymentReminderButton"
import { getLogoPath } from "@/lib/settings"
import Image from "next/image"
import { CompensationEligibilityManager } from "@/components/accounts/CompensationEligibilityManager"
import { BillItemsTable } from "@/components/invoices/BillItemsTable"

export const dynamic = 'force-dynamic'

async function markBillAsPaid(formData: FormData) {
  "use server"
  const billId = formData.get("billId") as string
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  
  if (session?.user.role !== "ADMIN" && session?.user.role !== "MANAGER") {
    redirect("/dashboard")
  }
  
  await prisma.bill.update({
    where: { id: billId },
    data: {
      status: BillStatus.PAID,
      paidAt: new Date(),
    },
  })
  
  // Calculate finder fees if invoice was just marked as PAID
  try {
    const { calculateAndCreateFinderFees } = await import("@/lib/finder-fee-helpers")
    await calculateAndCreateFinderFees(billId)
  } catch (error) {
    // Log error but don't fail the request
    console.error("Error calculating finder fees:", error)
    if (error instanceof Error) {
      console.error("Finder fee error details:", error.message, error.stack)
    }
  }
  
  redirect(`/dashboard/bills/${billId}`)
}

export default async function BillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  const bill = await prisma.bill.findUnique({
    where: { id },
    include: {
      client: true,
      proposal: {
        include: {
          items: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          currency: true,
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
      creator: {
        select: {
          name: true,
          email: true,
        },
      },
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
    },
  })

  if (!bill) {
    notFound()
  }

  // Check if client can access this bill
  if (session?.user.role === "CLIENT") {
    const client = await prisma.client.findFirst({
      where: { email: session.user.email },
    })
    if (!client || bill.clientId !== client.id) {
      return <div>Access denied</div>
    }
  }

  // Get user with permissions
  const user = session ? await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      canApproveInvoices: true,
      canEditAllInvoices: true,
    },
  }) : null

  // Fetch users for person dropdown in editable items
  const users = session?.user.role !== "CLIENT" ? await prisma.user.findMany({
    where: {
      role: { not: "CLIENT" },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: { name: "asc" },
  }) : []

  const getStatusColor = (status: BillStatus) => {
    switch (status) {
      case "DRAFT":
        return "bg-gray-100 text-gray-800"
      case "SUBMITTED":
        return "bg-blue-100 text-blue-800"
      case "APPROVED":
        return "bg-green-100 text-green-800"
      case "PAID":
        return "bg-emerald-100 text-emerald-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Fetch logo
  const logoPath = await getLogoPath()

  // Check if user can edit using permission function
  const canEdit = user ? canEditInvoice(user, {
    createdBy: bill.createdBy,
    status: bill.status,
  }) : false

  // Check if user can approve
  const userApproval = bill.approvals.find(a => a.approverId === session?.user.id)
  const canApprove = user && session && bill.status === BillStatus.SUBMITTED && (
    bill.requiredApproverIds.includes(session.user.id) ||
    (canApproveInvoices(user) && (!userApproval || userApproval.status === "PENDING"))
  )

  const canMarkPaid = (session?.user.role === "ADMIN" || session?.user.role === "MANAGER") &&
    bill.status === BillStatus.APPROVED

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

      <OutstandingInvoiceAlert invoice={bill} />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Invoice: {formatCurrency(bill.amount, bill.project?.currency || "EUR")}</h1>
          {bill.invoiceNumber && (
            <p className="text-lg text-gray-600 mt-1">Invoice Number: {bill.invoiceNumber}</p>
          )}
          {bill.description && (
            <p className="text-gray-600 mt-2">{bill.description}</p>
          )}
          <span className={`px-2 py-1 rounded-full text-xs font-medium mt-2 inline-block ${getStatusColor(bill.status)}`}>
            {bill.status}
          </span>
        </div>
        <div className="flex space-x-2">
          <DownloadPdfButton billId={bill.id} />
          {bill.client?.email && (
            <>
              <SendInvoiceEmailButton invoiceId={bill.id} />
              {bill.status !== BillStatus.PAID && bill.dueDate && new Date(bill.dueDate) < new Date() && (
                <SendPaymentReminderButton invoiceId={bill.id} />
              )}
            </>
          )}
          {canEdit && (
            <Link href={`/dashboard/bills/${bill.id}/edit`}>
              <Button variant="outline">Edit</Button>
            </Link>
          )}
          {bill.status === BillStatus.DRAFT && session?.user.role !== "CLIENT" && bill.createdBy === session?.user.id && (
            <SubmitInvoiceButton
              invoiceId={bill.id}
              canSubmit={true}
            />
          )}
          {canMarkPaid && (
            <form action={markBillAsPaid}>
              <input type="hidden" name="billId" value={bill.id} />
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                Mark as Paid
              </Button>
            </form>
          )}
          {session?.user.role === "ADMIN" && (
            <DeleteButton
              itemId={bill.id}
              itemType="invoice"
              itemName={bill.invoiceNumber || undefined}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{bill.client.name}</p>
            {bill.client.company && (
              <p className="text-sm text-gray-600">{bill.client.company}</p>
            )}
            {bill.client.email && (
              <p className="text-sm text-gray-600">{bill.client.email}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bill.invoiceNumber && (
              <div>
                <span className="text-sm text-gray-600">Invoice Number: </span>
                <span className="font-semibold">{bill.invoiceNumber}</span>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-600">Subtotal: </span>
              <span className="font-semibold">{formatCurrency(bill.subtotal || bill.amount, bill.project?.currency || "EUR")}</span>
            </div>
            {(bill.discountPercent || bill.discountAmount) && (
              <div>
                <span className="text-sm text-gray-600">Discount: </span>
                <span className="text-red-600">
                  {bill.discountPercent
                    ? `${bill.discountPercent}%`
                    : bill.discountAmount
                    ? formatCurrency(bill.discountAmount, bill.project?.currency || "EUR")
                    : "-"}
                </span>
              </div>
            )}
            {bill.taxRate && bill.taxRate > 0 && (
              <div>
                <span className="text-sm text-gray-600">Tax Rate: </span>
                <span>
                  {bill.taxRate}%
                  {bill.taxInclusive && <span className="text-xs text-gray-500 ml-1">(included)</span>}
                </span>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-600">Total Amount: </span>
              <span className="font-semibold text-lg">{formatCurrency(bill.amount, bill.project?.currency || "EUR")}</span>
            </div>
            {bill.dueDate && (
              <div>
                <span className="text-sm text-gray-600">Due Date: </span>
                <span>{formatDate(bill.dueDate)}</span>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-600">Created by: </span>
              <span>{bill.creator.name}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Created: </span>
              <span>{formatDate(bill.createdAt)}</span>
            </div>
            {bill.submittedAt && (
              <div>
                <span className="text-sm text-gray-600">Submitted: </span>
                <span>{formatDate(bill.submittedAt)}</span>
              </div>
            )}
            {bill.paidAt && (
              <div>
                <span className="text-sm text-gray-600">Paid: </span>
                <span>{formatDate(bill.paidAt)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice Line Items */}
      <BillItemsTable
        items={bill.items.map((item) => ({
          ...item,
          billedHours: (item as any).billedHours || null,
          isManuallyEdited: (item as any).isManuallyEdited || false,
        }))}
        billId={bill.id}
        currency={bill.project?.currency || "EUR"}
        canEdit={canEdit}
        users={users}
        subtotal={bill.subtotal || bill.amount}
      />

      {/* Invoice Summary with Tax and Discount Breakdown */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Invoice Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal (before credits):</span>
              <span className="font-semibold">
                {formatCurrency(bill.subtotal || bill.amount, bill.project?.currency || "EUR")}
              </span>
            </div>
            
            {/* Show credits if any */}
            {bill.items && bill.items.some(item => item.isCredit) && (
              <div className="flex justify-between text-red-600">
                <span>Credits Applied:</span>
                <span>
                  {formatCurrency(
                    -bill.items
                      .filter(item => item.isCredit)
                      .reduce((sum, item) => sum + item.amount, 0),
                    bill.project?.currency || "EUR"
                  )}
                </span>
              </div>
            )}
            
            {(bill.discountPercent || bill.discountAmount) && (
              <div className="flex justify-between text-red-600">
                <span>Discount:</span>
                <span>
                  {bill.discountPercent
                    ? `${bill.discountPercent}% (${formatCurrency(
                        ((bill.subtotal || bill.amount) * bill.discountPercent) / 100,
                        bill.project?.currency || "EUR"
                      )})`
                    : bill.discountAmount
                    ? formatCurrency(bill.discountAmount, bill.project?.currency || "EUR")
                    : "-"}
                </span>
              </div>
            )}

            {bill.taxRate && bill.taxRate > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">
                  Tax ({bill.taxRate}%):
                  {bill.taxInclusive && <span className="text-xs text-gray-500 ml-1">(included)</span>}
                </span>
                <span>
                  {(() => {
                    // Calculate subtotal after credits
                    const creditAmount = bill.items && bill.items.some(item => item.isCredit)
                      ? -bill.items.filter(item => item.isCredit).reduce((sum, item) => sum + item.amount, 0)
                      : 0
                    const subtotalAfterCredits = (bill.subtotal || bill.amount) - creditAmount
                    const discountValue = bill.discountPercent
                      ? (subtotalAfterCredits * bill.discountPercent) / 100
                      : bill.discountAmount || 0
                    const afterDiscount = subtotalAfterCredits - discountValue
                    const taxAmount = bill.taxInclusive
                      ? (afterDiscount * bill.taxRate) / (100 + bill.taxRate)
                      : (afterDiscount * bill.taxRate) / 100
                    return formatCurrency(taxAmount, bill.project?.currency || "EUR")
                  })()}
                </span>
              </div>
            )}

            <div className="flex justify-between border-t-2 pt-2 text-lg font-bold">
              <span>Total:</span>
              <span>{formatCurrency(bill.amount, bill.project?.currency || "EUR")}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {bill.proposal && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Related Proposal</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href={`/dashboard/proposals/${bill.proposal.id}`} className="text-primary hover:underline">
              {bill.proposal.title}
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Internal Approval Status */}
      {bill.internalApprovalRequired && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Internal Approval Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <span className="text-sm text-gray-600">Approval Requirement: </span>
                <span className="font-semibold">{bill.internalApprovalType || "ALL"}</span>
              </div>
              <div>
                <span className="text-sm text-gray-600">Status: </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  bill.internalApprovalsComplete
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}>
                  {bill.internalApprovalsComplete ? "Complete" : "Pending"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {canApprove && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <ApprovalButton
              billId={bill.id}
              currentUserRole={session?.user.role || "CLIENT"}
            />
          </CardContent>
        </Card>
      )}

      {bill.approvals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Approval History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {bill.approvals.map((approval) => (
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

      {/* Compensation Eligibility Section (Admin only) */}
      {session?.user.role === "ADMIN" && (
        <Card className="mt-8">
          <CompensationEligibilityManager
            billId={id}
            isAdmin={true}
          />
        </Card>
      )}
    </div>
  )
}

