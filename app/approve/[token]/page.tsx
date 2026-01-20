import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatDate, formatCurrency } from "@/lib/utils"
import { ClientApprovalAction } from "./ClientApprovalAction"

const CURRENCIES: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
}

export default async function ClientApprovalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ action?: string }>
}) {
  const { token } = await params
  const { action } = await searchParams

  // Find proposal by token
  const proposal = await prisma.proposal.findFirst({
    where: {
      clientApprovalToken: token,
    },
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
              name: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!proposal) {
    notFound()
  }

  // Check if token is expired
  if (proposal.clientApprovalTokenExpiry && new Date() > proposal.clientApprovalTokenExpiry) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Approval Link Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              This approval link has expired. Please contact the proposal creator to request a new approval link.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check if already approved/rejected
  if (proposal.clientApprovalStatus !== "PENDING") {
    const status = proposal.clientApprovalStatus.toLowerCase()
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className={status === "approved" ? "text-green-600" : "text-red-600"}>
              Proposal Already {status === "approved" ? "Approved" : "Rejected"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              This proposal has already been {status}.
            </p>
            {proposal.clientApprovedAt && (
              <p className="text-sm text-gray-500 mt-2">
                Approved on: {formatDate(proposal.clientApprovedAt)}
              </p>
            )}
            {proposal.clientRejectedAt && (
              <p className="text-sm text-gray-500 mt-2">
                Rejected on: {formatDate(proposal.clientRejectedAt)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    )
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

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">Proposal Approval</CardTitle>
            <CardDescription>
              Please review the proposal below and approve or reject it
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{proposal.title}</CardTitle>
            {proposal.proposalNumber && (
              <CardDescription>Proposal #{proposal.proposalNumber}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {proposal.client && (
              <div>
                <p className="text-sm text-gray-600">Client</p>
                <p className="font-semibold">{proposal.client.name}</p>
                {proposal.client.company && (
                  <p className="text-sm text-gray-600">{proposal.client.company}</p>
                )}
              </div>
            )}
            {proposal.description && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Description</p>
                <p className="whitespace-pre-wrap">{proposal.description}</p>
              </div>
            )}
            {proposal.issueDate && (
              <div>
                <p className="text-sm text-gray-600">Issue Date</p>
                <p>{formatDate(proposal.issueDate)}</p>
              </div>
            )}
            {proposal.expiryDate && (
              <div>
                <p className="text-sm text-gray-600">Expiry Date</p>
                <p>{formatDate(proposal.expiryDate)}</p>
              </div>
            )}
          </CardContent>
        </Card>

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
                      <th className="text-left p-2">Description</th>
                      <th className="text-right p-2">Quantity</th>
                      <th className="text-right p-2">Unit Price</th>
                      <th className="text-right p-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposal.items.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="p-2">{item.description}</td>
                        <td className="p-2 text-right">{item.quantity || "-"}</td>
                        <td className="p-2 text-right">
                          {item.rate ? `${currencySymbol}${item.rate.toFixed(2)}/hr` : item.unitPrice ? `${currencySymbol}${item.unitPrice.toFixed(2)}` : "-"}
                        </td>
                        <td className="p-2 text-right font-semibold">{currencySymbol}{item.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

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

        <Card>
          <CardHeader>
            <CardTitle>Approve or Reject</CardTitle>
            <CardDescription>
              Click the button below to approve or reject this proposal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ClientApprovalAction proposalId={proposal.id} token={token} action={action} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}





