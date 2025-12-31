import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { notFound } from "next/navigation"
import { formatDate, formatCurrency } from "@/lib/utils"
import { ProjectStatus } from "@prisma/client"
import Link from "next/link"

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
  const totalBilled = project.bills.reduce((sum, bill) => sum + bill.amount, 0)
  const variance = proposedAmount - totalBilled
  const variancePercent = proposedAmount > 0 ? (variance / proposedAmount) * 100 : 0

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

      {/* Bills Section */}
      <Card>
        <CardHeader>
          <CardTitle>Bills & Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {project.bills.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No bills yet</p>
          ) : (
            <div className="space-y-4">
              {project.bills.map((bill) => (
                <Link key={bill.id} href={`/dashboard/bills/${bill.id}`}>
                  <div className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{formatCurrency(bill.amount)}</p>
                        <p className="text-sm text-gray-600">
                          Created by {bill.creator.name} • {formatDate(bill.createdAt)}
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

