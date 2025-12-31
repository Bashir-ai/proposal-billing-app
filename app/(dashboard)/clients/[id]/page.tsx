import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { notFound } from "next/navigation"
import { formatDate } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return null

  if (session.user.role === "CLIENT") {
    return <div>Access denied</div>
  }

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      creator: {
        select: {
          name: true,
          email: true,
        },
      },
      proposals: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              items: true,
            },
          },
        },
      },
      bills: {
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!client) {
    notFound()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{client.name}</h1>
          {client.company && (
            <p className="text-gray-600 mt-2">{client.company}</p>
          )}
        </div>
        <Link href={`/dashboard/clients/${client.id}/edit`}>
          <Button variant="outline">Edit</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {client.email && (
              <div>
                <span className="text-sm text-gray-600">Email: </span>
                <span>{client.email}</span>
              </div>
            )}
            {client.contactInfo && (
              <div>
                <span className="text-sm text-gray-600">Contact: </span>
                <span>{client.contactInfo}</span>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-600">Created: </span>
              <span>{formatDate(client.createdAt)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="text-sm text-gray-600">Total Proposals: </span>
              <span className="font-semibold">{client.proposals.length}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Total Bills: </span>
              <span className="font-semibold">{client.bills.length}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Total Revenue: </span>
              <span className="font-semibold">
                {formatCurrency(
                  client.bills
                    .filter((b) => b.status === "PAID")
                    .reduce((sum, b) => sum + b.amount, 0)
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Proposals</CardTitle>
              <Link href="/dashboard/proposals/new">
                <Button size="sm" variant="outline">
                  New Proposal
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {client.proposals.length === 0 ? (
              <p className="text-sm text-gray-500">No proposals yet</p>
            ) : (
              <div className="space-y-2">
                {client.proposals.slice(0, 5).map((proposal) => (
                  <Link
                    key={proposal.id}
                    href={`/dashboard/proposals/${proposal.id}`}
                    className="block p-2 rounded hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{proposal.title}</p>
                        <p className="text-sm text-gray-500">
                          {proposal.type} • {proposal.status}
                        </p>
                      </div>
                      {proposal.amount && (
                        <span className="font-semibold">
                          {formatCurrency(proposal.amount)}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Bills</CardTitle>
              <Link href="/dashboard/bills/new">
                <Button size="sm" variant="outline">
                  New Bill
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {client.bills.length === 0 ? (
              <p className="text-sm text-gray-500">No bills yet</p>
            ) : (
              <div className="space-y-2">
                {client.bills.slice(0, 5).map((bill) => (
                  <Link
                    key={bill.id}
                    href={`/dashboard/bills/${bill.id}`}
                    className="block p-2 rounded hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">
                          {formatCurrency(bill.amount)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {bill.status} • {formatDate(bill.createdAt)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

