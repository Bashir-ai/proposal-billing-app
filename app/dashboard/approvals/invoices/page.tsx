import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { formatCurrency, formatDate } from "@/lib/utils"
import { BillStatus } from "@prisma/client"
import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'

export default async function ApproveInvoicesPage() {
  const session = await getServerSession(authOptions)

  if (!session || !session.user) {
    redirect("/login")
  }

  if (session.user.role === "CLIENT") {
    redirect("/dashboard")
  }

  const invoices = await prisma.bill.findMany({
    where: {
      status: BillStatus.SUBMITTED,
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          company: true,
        },
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
      },
    },
    orderBy: { submittedAt: "desc" },
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-green-100 text-green-800"
      case "REJECTED":
        return "bg-red-100 text-red-800"
      case "PENDING":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Approve Invoices</h1>
        <p className="text-gray-600 mt-2">Review and approve submitted invoices</p>
      </div>

      <div className="space-y-4">
        {invoices.map((invoice) => {
          const userApproval = invoice.approvals.find(
            (a) => a.approverId === session.user.id
          )
          const canApprove = session.user.role === "ADMIN" || 
            session.user.role === "MANAGER" ||
            invoice.createdBy !== session.user.id

          return (
            <Link key={invoice.id} href={`/dashboard/bills/${invoice.id}`}>
              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold">
                          {formatCurrency(invoice.amount)}
                        </h3>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          SUBMITTED
                        </span>
                        {invoice.resubmissionCount > 0 && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            Resubmitted {invoice.resubmissionCount} time{invoice.resubmissionCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        Client: {invoice.client.name}
                        {invoice.client.company && ` (${invoice.client.company})`}
                      </p>
                      <p className="text-sm text-gray-600 mb-2">
                        Created by: {invoice.creator.name} ({invoice.creator.email})
                      </p>
                      {invoice.approvals.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs font-semibold text-gray-600">Approval Status:</p>
                          {invoice.approvals.map((approval) => (
                            <div key={approval.id} className="flex items-center space-x-2">
                              <span className="text-xs text-gray-600">
                                {approval.approver.name}:
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(approval.status)}`}>
                                {approval.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {userApproval && (
                        <div className="mt-2">
                          <span className="text-xs text-gray-500">
                            Your status:{" "}
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(userApproval.status)}`}>
                              {userApproval.status}
                            </span>
                          </span>
                        </div>
                      )}
                      {canApprove && !userApproval && (
                        <div className="mt-2">
                          <span className="text-xs text-orange-600 font-semibold">
                            Your approval required
                          </span>
                        </div>
                      )}
                      <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500">
                        {invoice.submittedAt && (
                          <>
                            <span>Submitted: {formatDate(invoice.submittedAt)}</span>
                            {invoice.resubmittedAt && (
                              <>
                                <span>•</span>
                                <span>Resubmitted: {formatDate(invoice.resubmittedAt)}</span>
                              </>
                            )}
                          </>
                        )}
                        {invoice.dueDate && (
                          <>
                            <span>•</span>
                            <span>Due: {formatDate(invoice.dueDate)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2">
                      <Link href={`/dashboard/bills/${invoice.id}`}>
                        <Button variant="outline" size="sm" className="w-full">
                          View Details
                        </Button>
                      </Link>
                      {canApprove && !userApproval && (
                        <Link href={`/dashboard/bills/${invoice.id}`}>
                          <Button size="sm" className="w-full">
                            Review & Approve
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {invoices.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No invoices pending approval</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

