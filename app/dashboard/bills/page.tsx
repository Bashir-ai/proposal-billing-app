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
import { InvoiceStatusFilter } from "@/components/invoices/InvoiceStatusFilter"
import { InvoiceClientFilter } from "@/components/invoices/InvoiceClientFilter"
import { InvoiceProjectFilter } from "@/components/invoices/InvoiceProjectFilter"

export const dynamic = 'force-dynamic'

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; clientId?: string; projectId?: string }>
}) {
  try {
    const session = await getServerSession(authOptions)
    const params = await searchParams
    const statusParam = params?.status
    const clientIdParam = params?.clientId
    const projectIdParam = params?.projectId

    if (!session || !session.user) {
      return <div>Please log in to view invoices.</div>
    }

    // Build where clause
    const where: any = {
      deletedAt: null, // Exclude deleted items
    }
    
    // Handle status filter (support comma-separated values and "outstanding")
    if (statusParam) {
      if (statusParam === "OUTSTANDING") {
        // Outstanding: status != PAID && dueDate < now
        where.status = { not: "PAID" }
        where.dueDate = { lt: new Date() }
      } else {
        const statuses = statusParam.split(",").map(s => s.trim())
        if (statuses.length === 1) {
          where.status = statuses[0]
        } else {
          where.status = { in: statuses }
        }
      }
    }

    // Filter by client
    if (clientIdParam) {
      where.clientId = clientIdParam
    }

    // Filter by project
    if (projectIdParam) {
      where.projectId = projectIdParam
    }

    // Filter for clients
    if (session.user.role === "CLIENT") {
      const client = await prisma.client.findFirst({
        where: { email: session.user.email },
      })
      if (client) {
        where.clientId = client.id
      } else {
        return (
          <div>
            <h1 className="text-3xl font-bold">Invoices</h1>
            <p className="text-gray-600 mt-2">No invoices found.</p>
          </div>
        )
      }
    }

    const bills = await prisma.bill.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            company: true,
          },
        },
        proposal: {
          select: {
            title: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Fetch clients and projects for filter dropdowns (only for non-client users)
    const clients = session.user.role !== "CLIENT" 
      ? await prisma.client.findMany({
          select: { id: true, name: true, company: true },
          orderBy: { name: "asc" },
        })
      : []

    const projects = session.user.role !== "CLIENT"
      ? await prisma.project.findMany({
          where: { deletedAt: null },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : []

    const filteredBills = bills

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
        case "CANCELLED":
          return "bg-red-100 text-red-800"
        case "WRITTEN_OFF":
          return "bg-orange-100 text-orange-800"
        default:
          return "bg-gray-100 text-gray-800"
      }
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Invoices</h1>
            <p className="text-gray-600 mt-2">Manage your invoices</p>
          </div>
          {session.user.role !== "CLIENT" && (
            <Link href="/dashboard/bills/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Invoice
              </Button>
            </Link>
          )}
        </div>

        <div className="mb-4 space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search invoices..."
                className="pl-10"
              />
            </div>
            <InvoiceStatusFilter />
            {session.user.role !== "CLIENT" && clients.length > 0 && (
              <InvoiceClientFilter clients={clients} />
            )}
            {session.user.role !== "CLIENT" && projects.length > 0 && (
              <InvoiceProjectFilter projects={projects} />
            )}
          </div>
          {(statusParam || clientIdParam || projectIdParam) && (
            <div className="text-sm text-gray-600">
              Filters:{" "}
              {statusParam && (
                <span>Status: {statusParam === "OUTSTANDING" ? "Outstanding" : statusParam.split(",").join(", ")}</span>
              )}
              {clientIdParam && (
                <span>
                  {statusParam && " • "}
                  Client: {clients.find(c => c.id === clientIdParam)?.name || clientIdParam}
                </span>
              )}
              {projectIdParam && (
                <span>
                  {(statusParam || clientIdParam) && " • "}
                  Project: {projects.find(p => p.id === projectIdParam)?.name || projectIdParam}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
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
                        {bill.status !== "PAID" && bill.dueDate && new Date(bill.dueDate) < new Date() && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Outstanding
                          </span>
                        )}
                      </div>
                      {bill.invoiceNumber && (
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          Invoice #{bill.invoiceNumber}
                        </p>
                      )}
                      <p className="text-sm text-gray-600 mb-2">
                        Client: {bill.client.name}
                        {bill.client.company && ` (${bill.client.company})`}
                      </p>
                      {bill.proposal && (
                        <p className="text-sm text-gray-500">
                          From proposal: {bill.proposal.title}
                        </p>
                      )}
                      {bill.project && (
                        <p className="text-sm text-gray-500">
                          Project: {bill.project.name}
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
              <p className="text-gray-500 mb-4">No invoices yet</p>
              {session.user.role !== "CLIENT" && (
                <Link href="/dashboard/bills/new">
                  <Button>Create Your First Invoice</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    )
  } catch (error) {
    console.error("Error loading invoices:", error)
  return (
    <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Error Loading Invoices</h1>
        <p className="text-red-600">{(error as Error).message}</p>
        <p className="text-sm text-gray-500 mt-2">Check the terminal for more details.</p>
    </div>
  )
  }
}
