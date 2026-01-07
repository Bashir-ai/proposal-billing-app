import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FileText, Receipt, Users, TrendingUp, FolderKanban } from "lucide-react"
import { NotificationsBox } from "@/components/dashboard/NotificationsBox"
import { getNotifications, Notification } from "@/lib/notifications"
import { FinancialSummary } from "@/components/dashboard/FinancialSummary"
import { calculateTotalUnbilledWork, calculateClosedProposalsNotCharged } from "@/lib/financial-calculations"
import { QuickTodoButton } from "@/components/dashboard/QuickTodoButton"

export default async function DashboardPage() {
  try {
    const session = await getServerSession(authOptions)

    // Fetch notifications server-side
    let notificationsData: { count: number; notifications: Notification[] } = { count: 0, notifications: [] }
    if (session) {
      notificationsData = await getNotifications(session.user.id, session.user.role)
    }

    // Build base where clauses for role-based filtering
    const clientWhere = session?.user.role === "CLIENT" 
      ? { client: { email: session?.user.email } }
      : undefined

    const [
      proposalsCount,
      billsCount,
      clientsCount,
      projectsCount,
      totalRevenue,
      invoicedNotPaid,
    ] = await Promise.all([
      prisma.proposal.count({
        where: {
          deletedAt: null,
          ...(clientWhere || {})
        },
      }),
      prisma.bill.count({
        where: {
          deletedAt: null,
          ...(clientWhere || {})
        },
      }),
      prisma.client.count(),
      prisma.project.count({
        where: {
          deletedAt: null,
          ...(clientWhere || {})
        },
      }),
      prisma.bill.aggregate({
        where: {
          status: "PAID",
          ...(session?.user.role === "CLIENT" 
            ? { client: { email: session?.user.email } }
            : {})
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.bill.aggregate({
        where: {
          status: { in: ["SUBMITTED", "APPROVED"] },
          ...(session?.user.role === "CLIENT" 
            ? { client: { email: session?.user.email } }
            : {})
        },
        _sum: {
          amount: true,
        },
      }),
    ])

    // Calculate additional financial metrics (with timeout protection)
    // These can be slow, so we'll catch errors and show 0 if they fail
    let unbilledWork = { timesheetHours: 0, totalAmount: 0, timesheetAmount: 0, chargesAmount: 0 }
    let closedProposalsNotCharged = 0
    
    try {
      const calculationsPromise = Promise.all([
        calculateTotalUnbilledWork(session?.user.role === "CLIENT" ? session?.user.email : undefined),
        calculateClosedProposalsNotCharged(session?.user.role === "CLIENT" ? session?.user.email : undefined),
      ])
      
      const timeoutPromise = new Promise<[typeof unbilledWork, number]>((_, reject) => 
        setTimeout(() => reject(new Error('Calculation timeout')), 10000) // 10 second timeout
      )
      
      const result = await Promise.race([
        calculationsPromise,
        timeoutPromise,
      ])
      
      unbilledWork = result[0]
      closedProposalsNotCharged = result[1]
    } catch (error) {
      console.warn("Financial calculations timed out or failed:", error)
      // Use default values (already set above)
    }

  const stats = [
    {
      name: "Proposals",
      value: proposalsCount,
      icon: FileText,
      href: "/dashboard/proposals",
      color: "text-blue-600",
      // Clicking will show all proposals, user can filter for accepted/rejected
    },
    {
      name: "Projects",
      value: projectsCount,
      icon: FolderKanban,
      href: "/projects",
      color: "text-indigo-600",
      // Clicking will show all projects, user can filter for ongoing/closed
    },
    {
      name: "Invoices",
      value: billsCount,
      icon: Receipt,
      href: "/dashboard/bills",
      color: "text-green-600",
      // Clicking will show all invoices, user can filter for paid/unpaid
    },
    {
      name: "Clients",
      value: clientsCount,
      icon: Users,
      href: "/dashboard/clients",
      color: "text-purple-600",
      // Clicking will show all clients, user can filter for active/non-active
    },
  ]

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back, {session?.user.name}</p>
        </div>
        {session && (
          <NotificationsBox
            initialCount={notificationsData.count}
            initialNotifications={notificationsData.notifications}
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link key={stat.name} href={stat.href}>
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    {stat.name}
                  </CardTitle>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {session?.user.role !== "CLIENT" && (
              <Link href="/dashboard/proposals/new">
                <Button className="w-full" variant="outline">
                  Create New Proposal
                </Button>
              </Link>
            )}
            {session?.user.role !== "CLIENT" && (
              <Link href="/dashboard/bills/new">
                <Button className="w-full" variant="outline">
                  Create New Invoice
                </Button>
              </Link>
            )}
            {session?.user.role !== "CLIENT" && (
              <Link href="/dashboard/clients/new">
                <Button className="w-full" variant="outline">
                  Add New Client
                </Button>
              </Link>
            )}
            {session?.user.role !== "CLIENT" && (
              <Link href="/dashboard/approvals/proposals">
                <Button className="w-full" variant="outline">
                  Approve Proposals
                </Button>
              </Link>
            )}
            {session?.user.role !== "CLIENT" && (
              <Link href="/dashboard/approvals/invoices">
                <Button className="w-full" variant="outline">
                  Approve Invoices
                </Button>
              </Link>
            )}
            {session?.user.role !== "CLIENT" && (
              <QuickTodoButton />
            )}
          </CardContent>
        </Card>
        </div>
        <div className="lg:col-span-1">
          <FinancialSummary
            totalRevenue={totalRevenue._sum.amount || 0}
            invoicedNotPaid={invoicedNotPaid._sum.amount || 0}
            closedProposalsNotCharged={closedProposalsNotCharged}
            unbilledWork={{
              timesheetHours: unbilledWork.timesheetHours,
              totalAmount: unbilledWork.totalAmount,
            }}
          />
        </div>
      </div>
    </div>
    )
  } catch (error) {
    // If there's an error (e.g., database connection), show a fallback UI
    console.error("Error loading dashboard:", error)
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600 mt-2">Unable to load dashboard data. Please try again later.</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">
              There was an error connecting to the database. Please check your connection and try again.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }
}
