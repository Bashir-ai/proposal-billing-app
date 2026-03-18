import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { notFound } from "next/navigation"
import { formatDate, formatCurrency } from "@/lib/utils"
import { getLogoPath } from "@/lib/settings"
import Image from "next/image"
import Link from "next/link"
import { SendProjectReportEmailButton } from "@/components/projects/SendProjectReportEmailButton"

export const dynamic = 'force-dynamic'

export default async function ProjectReportsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  if (!session) {
    return <div>Please log in to view project reports.</div>
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          company: true,
          email: true,
        },
      },
      proposal: {
        select: {
          id: true,
          title: true,
          amount: true,
          currency: true,
        },
      },
      bills: {
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
      projectManagers: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  })

  if (!project) {
    notFound()
  }

  // Fetch logo
  const logoPath = await getLogoPath()

  // Calculate totals
  const totalHours = project.timesheetEntries.reduce((sum, entry) => sum + entry.hours, 0)
  const totalBillableHours = project.timesheetEntries
    .filter((entry) => entry.billable)
    .reduce((sum, entry) => sum + entry.hours, 0)
  const totalBilledHours = project.timesheetEntries
    .filter((entry) => entry.billed)
    .reduce((sum, entry) => sum + entry.hours, 0)

  const totalTimesheetAmount = project.timesheetEntries.reduce((sum, entry) => {
    const amount = entry.hours * (entry.rate || 0)
    return sum + amount
  }, 0)

  const totalCharges = project.charges.reduce((sum, charge) => sum + charge.amount, 0)
  const totalBilled = project.bills.reduce((sum, bill) => sum + bill.amount, 0)

  const proposedAmount = project.proposal?.amount || 0
  const variance = proposedAmount - totalBilled

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

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Project Report: {project.name}</h1>
          <p className="text-gray-600 mt-2">Comprehensive project overview and financial summary</p>
        </div>
        {project.client.email && (
          <SendProjectReportEmailButton projectId={project.id} />
        )}
      </div>

      {/* Project Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Proposed Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(proposedAmount, project.currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Billed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalBilled, project.currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
            <div className="text-sm text-gray-500 mt-1">
              {totalBillableHours.toFixed(1)} billable
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Variance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${variance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(variance, project.currency)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client Information */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Client Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Client Name</p>
              <p className="font-semibold">{project.client.name}</p>
            </div>
            {project.client.company && (
              <div>
                <p className="text-sm text-gray-600">Company</p>
                <p className="font-semibold">{project.client.company}</p>
              </div>
            )}
            {project.client.email && (
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-semibold">{project.client.email}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Project Managers */}
      {project.projectManagers.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Project Managers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {project.projectManagers.map((pm) => (
                <div key={pm.id}>
                  <p className="font-semibold">{pm.user.name}</p>
                  <p className="text-sm text-gray-600">{pm.user.email}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timesheet Entries */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Timesheet Entries ({project.timesheetEntries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {project.timesheetEntries.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No timesheet entries</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">User</th>
                    <th className="text-right p-2">Hours</th>
                    <th className="text-right p-2">Rate</th>
                    <th className="text-right p-2">Amount</th>
                    <th className="text-center p-2">Billable</th>
                    <th className="text-center p-2">Billed</th>
                    <th className="text-left p-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {project.timesheetEntries.map((entry) => (
                    <tr key={entry.id} className="border-b">
                      <td className="p-2">{formatDate(entry.date)}</td>
                      <td className="p-2">{entry.user.name}</td>
                      <td className="p-2 text-right">{entry.hours.toFixed(2)}</td>
                      <td className="p-2 text-right">
                        {entry.rate ? formatCurrency(entry.rate, project.currency) : "-"}
                      </td>
                      <td className="p-2 text-right">
                        {formatCurrency(entry.hours * (entry.rate || 0), project.currency)}
                      </td>
                      <td className="p-2 text-center">
                        {entry.billable ? (
                          <span className="text-green-600">Yes</span>
                        ) : (
                          <span className="text-gray-400">No</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {entry.billed ? (
                          <span className="text-blue-600">Yes</span>
                        ) : (
                          <span className="text-gray-400">No</span>
                        )}
                      </td>
                      <td className="p-2">{entry.description || "-"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td colSpan={2} className="p-2">Total</td>
                    <td className="p-2 text-right">{totalHours.toFixed(2)}</td>
                    <td colSpan={2} className="p-2 text-right">
                      {formatCurrency(totalTimesheetAmount, project.currency)}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Charges */}
      {project.charges.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Project Charges ({project.charges.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Description</th>
                    <th className="text-right p-2">Quantity</th>
                    <th className="text-right p-2">Unit Price</th>
                    <th className="text-right p-2">Amount</th>
                    <th className="text-center p-2">Billed</th>
                    <th className="text-left p-2">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {project.charges.map((charge) => (
                    <tr key={charge.id} className="border-b">
                      <td className="p-2">{charge.description}</td>
                      <td className="p-2 text-right">{charge.quantity || 1}</td>
                      <td className="p-2 text-right">
                        {charge.unitPrice
                          ? formatCurrency(charge.unitPrice, project.currency)
                          : "-"}
                      </td>
                      <td className="p-2 text-right">
                        {formatCurrency(charge.amount, project.currency)}
                      </td>
                      <td className="p-2 text-center">
                        {charge.billed ? (
                          <span className="text-blue-600">Yes</span>
                        ) : (
                          <span className="text-gray-400">No</span>
                        )}
                      </td>
                      <td className="p-2">{charge.chargeType}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td colSpan={3} className="p-2">Total Charges</td>
                    <td className="p-2 text-right">
                      {formatCurrency(totalCharges, project.currency)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>Invoices ({project.bills.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {project.bills.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No invoices</p>
          ) : (
            <div className="space-y-4">
              {project.bills.map((bill) => (
                <Link key={bill.id} href={`/dashboard/bills/${bill.id}`}>
                  <div className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">
                          {bill.invoiceNumber || `Invoice #${bill.id.slice(0, 8)}`}
                        </p>
                        <p className="text-sm text-gray-600">
                          {formatCurrency(bill.amount, project.currency)} • Created by{" "}
                          {bill.creator.name} • {formatDate(bill.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          bill.status === "PAID"
                            ? "bg-green-100 text-green-800"
                            : bill.status === "APPROVED"
                            ? "bg-blue-100 text-blue-800"
                            : bill.status === "SUBMITTED"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
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


