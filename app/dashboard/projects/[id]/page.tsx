import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { notFound } from "next/navigation"
import { formatDate, formatCurrency } from "@/lib/utils"
import { ProjectStatus } from "@prisma/client"
import Link from "next/link"
import { Plus } from "lucide-react"

// Force dynamic rendering to ensure fresh data on each request
export const dynamic = 'force-dynamic'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      proposal: {
        include: {
          items: true,
          milestones: true,
          paymentTerms: {
            where: {
              proposalItemId: null, // Proposal-level payment terms only
            },
          },
          bills: {
            where: {
              deletedAt: null, // Exclude deleted bills
            },
            include: {
              creator: {
                select: {
                  name: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      bills: {
        where: {
          deletedAt: null, // Exclude deleted bills
        },
        include: {
          creator: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      timesheetEntries: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { date: "desc" },
      },
      charges: {
        orderBy: { createdAt: "desc" },
      },
      expenses: {
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          bill: {
            select: {
              id: true,
              invoiceNumber: true,
              amount: true,
            },
          },
        },
        orderBy: { expenseDate: "desc" },
      },
    },
  })

  if (!project) {
    notFound()
  }

  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800"
      case "COMPLETED":
        return "bg-blue-100 text-blue-800"
      case "ON_HOLD":
        return "bg-yellow-100 text-yellow-800"
      case "CANCELLED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const proposedAmount = project.proposal?.amount || 0
  
  // Combine bills from project and proposal (bills can be linked via projectId or proposalId)
  const allBills = [
    ...project.bills,
    ...(project.proposal?.bills || []).filter(
      proposalBill => !project.bills.some(projectBill => projectBill.id === proposalBill.id)
    )
  ]
  
  const totalBilled = allBills.reduce((sum, bill) => sum + bill.amount, 0)
  
  // Calculate expense totals
  const totalExpenses = project.expenses.reduce((sum, exp) => sum + exp.amount, 0)
  const billableExpenses = project.expenses.filter(exp => exp.isBillable)
  const totalBillableExpenses = billableExpenses.reduce((sum, exp) => sum + exp.amount, 0)
  const unbilledExpenses = project.expenses.filter(exp => exp.isBillable && !exp.billedAt)
  const totalUnbilledExpenses = unbilledExpenses.reduce((sum, exp) => sum + exp.amount, 0)
  
  const variance = proposedAmount - totalBilled
  const variancePercent = proposedAmount > 0 ? (variance / proposedAmount) * 100 : 0

  // Calculate upfront payment information
  const upfrontPaymentTerm = project.proposal?.paymentTerms?.find(
    pt => pt.upfrontType && pt.upfrontValue
  )
  
  let upfrontAmount = 0
  let upfrontPercent = 0
  if (upfrontPaymentTerm && upfrontPaymentTerm.upfrontType && upfrontPaymentTerm.upfrontValue) {
    if (upfrontPaymentTerm.upfrontType === "PERCENT") {
      upfrontPercent = upfrontPaymentTerm.upfrontValue
      upfrontAmount = (proposedAmount * upfrontPaymentTerm.upfrontValue) / 100
    } else {
      upfrontAmount = upfrontPaymentTerm.upfrontValue
      upfrontPercent = proposedAmount > 0 ? (upfrontAmount / proposedAmount) * 100 : 0
    }
  }

  // Get upfront invoices from all bills (explicitly check for true to handle null/undefined)
  const upfrontBills = allBills.filter(bill => bill.isUpfrontPayment === true)
  const upfrontBilled = upfrontBills.reduce((sum, bill) => sum + bill.amount, 0)
  const upfrontPaid = upfrontBills
    .filter(bill => bill.status === "PAID")
    .reduce((sum, bill) => sum + bill.amount, 0)
  const upfrontPaidPercent = upfrontAmount > 0 ? (upfrontPaid / upfrontAmount) * 100 : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <div className="flex items-center space-x-2 mt-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
              {project.status}
            </span>
            {project.proposal && (
              <Link href={`/dashboard/proposals/${project.proposal.id}`}>
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 hover:bg-purple-200 cursor-pointer">
                  View Source Proposal
                </span>
              </Link>
            )}
            <Link href={`/dashboard/projects/${project.id}/reports`}>
              <Button variant="outline" size="sm">
                View Project Report
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{project.client.name}</p>
            {project.client.company && (
              <p className="text-sm text-gray-600">{project.client.company}</p>
            )}
            {project.client.email && (
              <p className="text-sm text-gray-600">{project.client.email}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {project.startDate && (
              <div>
                <span className="text-sm text-gray-600">Start Date: </span>
                <span>{formatDate(project.startDate)}</span>
              </div>
            )}
            {project.endDate && (
              <div>
                <span className="text-sm text-gray-600">End Date: </span>
                <span>{formatDate(project.endDate)}</span>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-600">Created: </span>
              <span>{formatDate(project.createdAt)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {project.description && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{project.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Upfront Payment Section */}
      {upfrontPaymentTerm && upfrontAmount > 0 && (
        <Card className="mb-8 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Upfront Payment</span>
              <span className="text-sm font-normal text-gray-600">
                {upfrontPercent.toFixed(1)}% of Total
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Expected Upfront</p>
                  <p className="text-xl font-bold">{formatCurrency(upfrontAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Invoiced</p>
                  <p className="text-xl font-bold">{formatCurrency(upfrontBilled)}</p>
                  <p className="text-xs text-gray-500">
                    {upfrontBills.length} invoice{upfrontBills.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Paid</p>
                  <p className={`text-xl font-bold ${upfrontPaid >= upfrontAmount ? "text-green-600" : "text-yellow-600"}`}>
                    {formatCurrency(upfrontPaid)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {upfrontPaidPercent.toFixed(1)}% of upfront
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Status</p>
                  <p className={`text-lg font-semibold ${
                    upfrontPaid >= upfrontAmount ? "text-green-600" :
                    upfrontBilled > 0 ? "text-yellow-600" :
                    "text-gray-600"
                  }`}>
                    {upfrontPaid >= upfrontAmount ? "✓ Fully Paid" :
                     upfrontBilled > 0 ? "Invoice Sent" :
                     "Pending"}
                  </p>
                </div>
              </div>
              
              {upfrontBills.length > 0 && (
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <h4 className="font-semibold mb-2 text-sm">Upfront Invoices</h4>
                  <div className="space-y-2">
                    {upfrontBills.map((bill) => (
                      <Link key={bill.id} href={`/dashboard/bills/${bill.id}`}>
                        <div className="flex items-center justify-between p-2 bg-white rounded border border-blue-200 hover:bg-blue-50">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-medium text-blue-600">UPFRONT</span>
                            <span className="text-sm font-semibold">{formatCurrency(bill.amount)}</span>
                            {bill.invoiceNumber && (
                              <span className="text-xs text-gray-500">#{bill.invoiceNumber}</span>
                            )}
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            bill.status === "PAID" ? "bg-green-100 text-green-800" :
                            bill.status === "APPROVED" ? "bg-blue-100 text-blue-800" :
                            bill.status === "SUBMITTED" ? "bg-yellow-100 text-yellow-800" :
                            "bg-gray-100 text-gray-800"
                          }`}>
                            {bill.status}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparison Section */}
      {project.proposal && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Proposed vs Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Proposed Amount</p>
                  <p className="text-2xl font-bold">{formatCurrency(proposedAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Billed</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalBilled)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Variance</p>
                  <p className={`text-2xl font-bold ${variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(variance)}
                  </p>
                  <p className={`text-sm ${variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                    ({variancePercent >= 0 ? "+" : ""}{variancePercent.toFixed(1)}%)
                  </p>
                </div>
              </div>
              
              {/* Expense Summary */}
              {totalExpenses > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-semibold mb-3">Expense Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Total Expenses</p>
                      <p className="text-xl font-bold">{formatCurrency(totalExpenses)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Billable Expenses</p>
                      <p className="text-xl font-bold">{formatCurrency(totalBillableExpenses)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Unbilled Expenses</p>
                      <p className="text-xl font-bold text-yellow-600">{formatCurrency(totalUnbilledExpenses)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Billed Expenses</p>
                      <p className="text-xl font-bold text-green-600">
                        {formatCurrency(totalBillableExpenses - totalUnbilledExpenses)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {project.proposal.items && project.proposal.items.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold mb-2">Proposed Line Items</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Description</th>
                          <th className="text-right p-2">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {project.proposal.items.map((item) => (
                          <tr key={item.id} className="border-b">
                            <td className="p-2">{item.description}</td>
                            <td className="p-2 text-right">{formatCurrency(item.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timesheet Entries Section */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Timesheet Entries</CardTitle>
            <Link href={`/dashboard/projects/${id}/timesheets/new`}>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Entry
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {project.timesheetEntries.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No timesheet entries yet</p>
          ) : (
            <div className="space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">User</th>
                      <th className="text-right p-2">Hours</th>
                      <th className="text-right p-2">Rate</th>
                      <th className="text-right p-2">Amount</th>
                      <th className="text-center p-2">Billable</th>
                      <th className="text-center p-2">Billed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.timesheetEntries.map((entry) => (
                      <tr key={entry.id} className="border-b">
                        <td className="p-2">{formatDate(entry.date)}</td>
                        <td className="p-2">{entry.user.name}</td>
                        <td className="p-2 text-right">{entry.hours}</td>
                        <td className="p-2 text-right">
                          {entry.rate ? formatCurrency(entry.rate) : "—"}
                        </td>
                        <td className="p-2 text-right">
                          {formatCurrency((entry.rate || 0) * entry.hours)}
                        </td>
                        <td className="p-2 text-center">
                          {entry.billable ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {entry.billed ? (
                            <span className="text-blue-600">✓</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">Total Hours:</span>
                  <span>{project.timesheetEntries.reduce((sum, e) => sum + e.hours, 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="font-semibold">Total Billable Amount:</span>
                  <span>
                    {formatCurrency(
                      project.timesheetEntries
                        .filter((e) => e.billable)
                        .reduce((sum, e) => sum + (e.rate || 0) * e.hours, 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expenses Section */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Project Expenses</CardTitle>
            <Link href={`/dashboard/projects/${id}/expenses/new`}>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {project.expenses.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No expenses yet</p>
          ) : (
            <div className="space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-left p-2">Category</th>
                      <th className="text-right p-2">Amount</th>
                      <th className="text-center p-2">Billable</th>
                      <th className="text-center p-2">Reimbursement</th>
                      <th className="text-center p-2">Billed</th>
                      <th className="text-center p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.expenses.map((expense) => (
                      <tr key={expense.id} className="border-b">
                        <td className="p-2">{formatDate(expense.expenseDate)}</td>
                        <td className="p-2">{expense.description}</td>
                        <td className="p-2">{expense.category || "—"}</td>
                        <td className="p-2 text-right">{formatCurrency(expense.amount)}</td>
                        <td className="p-2 text-center">
                          {expense.isBillable ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {expense.isReimbursement ? (
                            <span className="text-blue-600">✓</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {expense.billedAt ? (
                            <div className="flex flex-col items-center">
                              <span className="text-blue-600">✓</span>
                              {expense.bill && (
                                <Link href={`/dashboard/bills/${expense.bill.id}`} className="text-xs text-blue-600 hover:underline">
                                  #{expense.bill.invoiceNumber || expense.bill.id.slice(0, 8)}
                                </Link>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          <Link href={`/dashboard/projects/${id}/expenses/${expense.id}/edit`}>
                            <Button variant="ghost" size="sm">
                              Edit
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-semibold">Total Expenses:</span>
                    <div className="text-lg">{formatCurrency(totalExpenses)}</div>
                  </div>
                  <div>
                    <span className="font-semibold">Billable Expenses:</span>
                    <div className="text-lg">{formatCurrency(totalBillableExpenses)}</div>
                  </div>
                  <div>
                    <span className="font-semibold">Unbilled Expenses:</span>
                    <div className="text-lg text-yellow-600">{formatCurrency(totalUnbilledExpenses)}</div>
                  </div>
                  <div>
                    <span className="font-semibold">Billed Expenses:</span>
                    <div className="text-lg text-green-600">
                      {formatCurrency(totalBillableExpenses - totalUnbilledExpenses)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charges Section */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Project Charges</CardTitle>
            <Link href={`/dashboard/projects/${id}/charges/new`}>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Charge
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {project.charges.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No charges yet</p>
          ) : (
            <div className="space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Description</th>
                      <th className="text-right p-2">Quantity</th>
                      <th className="text-right p-2">Unit Price</th>
                      <th className="text-right p-2">Amount</th>
                      <th className="text-center p-2">Type</th>
                      <th className="text-center p-2">Billed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.charges.map((charge) => (
                      <tr key={charge.id} className="border-b">
                        <td className="p-2">{charge.description}</td>
                        <td className="p-2 text-right">{charge.quantity || 1}</td>
                        <td className="p-2 text-right">
                          {charge.unitPrice ? formatCurrency(charge.unitPrice) : "—"}
                        </td>
                        <td className="p-2 text-right">{formatCurrency(charge.amount)}</td>
                        <td className="p-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            charge.chargeType === "RECURRING" 
                              ? "bg-blue-100 text-blue-800" 
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {charge.chargeType}
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          {charge.billed ? (
                            <span className="text-blue-600">✓</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">Total Charges:</span>
                  <span>
                    {formatCurrency(project.charges.reduce((sum, c) => sum + c.amount, 0))}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="font-semibold">Unbilled Amount:</span>
                  <span>
                    {formatCurrency(
                      project.charges
                        .filter((c) => !c.billed)
                        .reduce((sum, c) => sum + c.amount, 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bills Section */}
      <Card>
        <CardHeader>
          <CardTitle>Bills & Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {allBills.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No bills yet</p>
          ) : (
            <div className="space-y-4">
              {allBills.map((bill) => (
                <Link key={bill.id} href={`/dashboard/bills/${bill.id}`}>
                  <div className={`border rounded-lg p-4 hover:bg-gray-50 ${
                    bill.isUpfrontPayment ? "border-blue-300 bg-blue-50" : ""
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          {bill.isUpfrontPayment && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-200 text-blue-800">
                              UPFRONT
                            </span>
                          )}
                          <p className="font-semibold">{formatCurrency(bill.amount)}</p>
                          {bill.isUpfrontPayment && upfrontAmount > 0 && (
                            <span className="text-xs text-gray-500">
                              ({(bill.amount / upfrontAmount * 100).toFixed(1)}% of upfront)
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          Created by {bill.creator.name} • {formatDate(bill.createdAt)}
                          {bill.invoiceNumber && ` • Invoice #${bill.invoiceNumber}`}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        bill.status === "PAID" ? "bg-green-100 text-green-800" :
                        bill.status === "APPROVED" ? "bg-blue-100 text-blue-800" :
                        bill.status === "SUBMITTED" ? "bg-yellow-100 text-yellow-800" :
                        "bg-gray-100 text-gray-800"
                      }`}>
                        {bill.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


