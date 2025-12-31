import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { formatCurrency, formatDate } from "@/lib/utils"
import { BillStatus } from "@prisma/client"

export default async function BillsPage() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return <div>Please log in to view bills.</div>
    }

    const bills = await prisma.bill.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        client: {
          select: {
            name: true,
            company: true,
          },
        },
        proposal: {
          select: {
            title: true,
          },
        },
      },
    })

    // Filter for clients - get client by email and filter bills
    let filteredBills = bills
    if (session.user.role === "CLIENT") {
      const client = await prisma.client.findFirst({
        where: { email: session.user.email },
      })
      if (client) {
        filteredBills = bills.filter((bill) => bill.clientId === client.id)
      } else {
        filteredBills = []
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

    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Bills</h1>
            <p className="text-gray-600 mt-2">Manage your bills</p>
          </div>
          {session.user.role !== "CLIENT" && (
            <Link href="/dashboard/bills/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Bill
              </Button>
            </Link>
          )}
        </div>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search bills..."
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-4">
          {filteredBills.map((bill) => (
            <Link key={bill.id} href={`/dashboard/bills/${bill.id}`}>
              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold">
                          {formatCurrency(bill.amount)}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(bill.status)}`}>
                          {bill.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        Client: {bill.client.name}
                        {bill.client.company && ` (${bill.client.company})`}
                      </p>
                      {bill.proposal && (
                        <p className="text-sm text-gray-500">
                          From proposal: {bill.proposal.title}
                        </p>
                      )}
                      <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500">
                        {bill.dueDate && (
                          <>
                            <span>Due: {formatDate(bill.dueDate)}</span>
                            <span>•</span>
                          </>
                        )}
                        <span>Created: {formatDate(bill.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {filteredBills.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500 mb-4">No bills yet</p>
              {session.user.role !== "CLIENT" && (
                <Link href="/dashboard/bills/new">
                  <Button>Create Your First Bill</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    )
  } catch (error) {
    console.error("Error loading bills:", error)
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Error Loading Bills</h1>
        <p className="text-red-600">{(error as Error).message}</p>
        <p className="text-sm text-gray-500 mt-2">Check the terminal for more details.</p>
      </div>
    )
  }
}
