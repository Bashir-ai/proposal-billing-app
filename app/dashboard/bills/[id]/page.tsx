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

async function submitBill(formData: FormData) {
  "use server"
  const billId = formData.get("billId") as string
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  
  await prisma.bill.update({
    where: { id: billId },
    data: {
      status: BillStatus.SUBMITTED,
      submittedAt: new Date(),
    },
  })
  
  redirect(`/dashboard/bills/${billId}`)
}

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

  const canEdit = bill.status === BillStatus.DRAFT && 
    (session?.user.role !== "CLIENT" && bill.createdBy === session?.user.id)

  const canMarkPaid = (session?.user.role === "ADMIN" || session?.user.role === "MANAGER") &&
    bill.status === BillStatus.APPROVED

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Bill: {formatCurrency(bill.amount)}</h1>
          <span className={`px-2 py-1 rounded-full text-xs font-medium mt-2 inline-block ${getStatusColor(bill.status)}`}>
            {bill.status}
          </span>
        </div>
        <div className="flex space-x-2">
          {canEdit && (
            <Link href={`/dashboard/bills/${bill.id}/edit`}>
              <Button variant="outline">Edit</Button>
            </Link>
          )}
          {bill.status === BillStatus.DRAFT && session?.user.role !== "CLIENT" && (
            <form action={submitBill}>
              <input type="hidden" name="billId" value={bill.id} />
              <Button type="submit">Submit for Approval</Button>
            </form>
          )}
          {canMarkPaid && (
            <form action={markBillAsPaid}>
              <input type="hidden" name="billId" value={bill.id} />
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                Mark as Paid
              </Button>
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
            <CardTitle>Bill Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="text-sm text-gray-600">Amount: </span>
              <span className="font-semibold text-lg">{formatCurrency(bill.amount)}</span>
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

      {bill.status === BillStatus.SUBMITTED && 
       session?.user.role !== "CLIENT" && 
       session?.user.id !== bill.createdBy && (
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
    </div>
  )
}

