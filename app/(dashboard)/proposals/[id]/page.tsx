import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { notFound } from "next/navigation"
import { formatDate, formatCurrency } from "@/lib/utils"
import { ProposalStatus, ProposalType } from "@prisma/client"
import Link from "next/link"
import { ApprovalButton } from "@/components/shared/ApprovalButton"

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return null

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
        orderBy: { createdAt: "asc" },
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
      bills: true,
    },
  })

  if (!proposal) {
    notFound()
  }

  // Check if client can access this proposal
  if (session.user.role === "CLIENT") {
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
      case "HOURLY":
        return "Hourly Basis"
      case "LUMP_SUM":
        return "Lump Sum"
      case "SUBJECT_BASIS":
        return "Subject Basis"
      case "SUCCESS_FEE":
        return "Success Fee"
      default:
        return type
    }
  }

  const canEdit = proposal.status === ProposalStatus.DRAFT && 
    (session.user.role !== "CLIENT" && proposal.createdBy === session.user.id)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{proposal.title}</h1>
          <div className="flex items-center space-x-2 mt-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(proposal.status)}`}>
              {proposal.status}
            </span>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              {getTypeLabel(proposal.type)}
            </span>
          </div>
        </div>
        <div className="flex space-x-2">
          {canEdit && (
            <Link href={`/dashboard/proposals/${proposal.id}/edit`}>
              <Button variant="outline">Edit</Button>
            </Link>
          )}
          {proposal.status === ProposalStatus.DRAFT && session.user.role !== "CLIENT" && (
            <form action={async () => {
              "use server"
              const proposalId = proposal.id
              await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/proposals/${proposalId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "submit" }),
              })
            }}>
              <Button type="submit">Submit for Approval</Button>
            </form>
          )}
        </div>
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
            {proposal.amount && (
              <div>
                <span className="text-sm text-gray-600">Total Amount: </span>
                <span className="font-semibold text-lg">{formatCurrency(proposal.amount)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
            <CardTitle>
              {proposal.type === ProposalType.HOURLY && "Time Entries"}
              {proposal.type === ProposalType.SUBJECT_BASIS && "Line Items"}
              {proposal.type === ProposalType.SUCCESS_FEE && "Fee Structure"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    {proposal.type === ProposalType.HOURLY && <th className="text-left p-2">Date</th>}
                    <th className="text-left p-2">Description</th>
                    {proposal.type === ProposalType.HOURLY && (
                      <>
                        <th className="text-right p-2">Hours</th>
                        <th className="text-right p-2">Rate</th>
                      </>
                    )}
                    <th className="text-right p-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.items.map((item) => (
                    <tr key={item.id} className="border-b">
                      {proposal.type === ProposalType.HOURLY && item.date && (
                        <td className="p-2">{formatDate(item.date)}</td>
                      )}
                      <td className="p-2">{item.description}</td>
                      {proposal.type === ProposalType.HOURLY && (
                        <>
                          <td className="p-2 text-right">{item.quantity || 0}</td>
                          <td className="p-2 text-right">{formatCurrency(item.rate || 0)}</td>
                        </>
                      )}
                      <td className="p-2 text-right font-semibold">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td colSpan={proposal.type === ProposalType.HOURLY ? 4 : 2} className="p-2 text-right">
                      Total
                    </td>
                    <td className="p-2 text-right">
                      {formatCurrency(proposal.items.reduce((sum, item) => sum + item.amount, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {proposal.status === ProposalStatus.SUBMITTED && 
       session.user.role !== "CLIENT" && 
       session.user.id !== proposal.createdBy && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <ApprovalButton
              proposalId={proposal.id}
              currentUserRole={session.user.role}
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

