import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FileText, Receipt, Users, FolderKanban, Plus, ArrowRight, TrendingUp, Clock, CheckCircle2 } from "lucide-react"
import { NotificationsBox } from "@/components/dashboard/NotificationsBox"
import { getNotifications, Notification } from "@/lib/notifications"
import { FinancialSummary } from "@/components/dashboard/FinancialSummary"
import { calculateTotalUnbilledWork, calculateClosedProposalsNotCharged } from "@/lib/financial-calculations"
import { QuickTodoButton } from "@/components/dashboard/QuickTodoButton"

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  // Redirect EXTERNAL users to accounts page (must be outside try-catch)
  if (session?.user.role === "EXTERNAL") {
    redirect("/dashboard/accounts")
  }

  try {

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
      prisma.client.count({
        where: {
          deletedAt: null,
        },
      }),
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
    let unbilledWork = { timesheetHours: 0, totalAmount: 0, timesheetAmount: 0, chargesAmount: 0 }
    let closedProposalsNotCharged = 0
    
    try {
      const calculationsPromise = Promise.all([
        calculateTotalUnbilledWork(session?.user.role === "CLIENT" ? session?.user.email : undefined),
        calculateClosedProposalsNotCharged(session?.user.role === "CLIENT" ? session?.user.email : undefined),
      ])
      
      const timeoutPromise = new Promise<[typeof unbilledWork, number]>((_, reject) => 
        setTimeout(() => reject(new Error('Calculation timeout')), 10000)
      )
      
      const result = await Promise.race([
        calculationsPromise,
        timeoutPromise,
      ])
      
      unbilledWork = result[0]
      closedProposalsNotCharged = result[1]
    } catch (error) {
      console.warn("Financial calculations timed out or failed:", error)
    }

  const stats = [
    {
      name: "Proposals",
      value: proposalsCount,
      icon: FileText,
      href: "/dashboard/proposals",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      description: "Total proposals"
    },
    {
      name: "Projects",
      value: projectsCount,
      icon: FolderKanban,
      href: "/projects",
      color: "text-violet-600",
      bgColor: "bg-violet-50",
      description: "Active projects"
    },
    {
      name: "Invoices",
      value: billsCount,
      icon: Receipt,
      href: "/dashboard/bills",
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      description: "Total invoices"
    },
    {
      name: "Clients",
      value: clientsCount,
      icon: Users,
      href: "/dashboard/clients",
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      description: "Registered clients"
    },
  ]

  const quickActions = [
    { name: "New Proposal", href: "/dashboard/proposals/new", icon: FileText },
    { name: "New Invoice", href: "/dashboard/bills/new", icon: Receipt },
    { name: "New Client", href: "/dashboard/clients/new", icon: Users },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {session?.user.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {session && (
            <NotificationsBox
              initialCount={notificationsData.count}
              initialNotifications={notificationsData.notifications}
            />
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link key={stat.name} href={stat.href}>
              <Card className="group hover:shadow-md transition-all duration-200 hover:border-border/80">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        {stat.name}
                      </p>
                      <p className="text-3xl font-semibold tracking-tight">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.description}</p>
                    </div>
                    <div className={`p-2.5 rounded-lg ${stat.bgColor} transition-transform duration-200 group-hover:scale-110`}>
                      <Icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {session?.user.role !== "CLIENT" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {quickActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <Link key={action.name} href={action.href}>
                      <Button
                        variant="outline"
                        className="w-full h-auto py-4 flex flex-col items-center gap-2 hover:bg-accent hover:border-accent transition-colors"
                      >
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm font-medium">{action.name}</span>
                      </Button>
                    </Link>
                  )
                })}
              </div>
            )}
            
            {session?.user.role !== "CLIENT" && (
              <div className="pt-3 space-y-2">
                <Link href="/dashboard/approvals/proposals">
                  <Button variant="ghost" className="w-full justify-between group">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      Approve Proposals
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </Button>
                </Link>
                <Link href="/dashboard/approvals/invoices">
                  <Button variant="ghost" className="w-full justify-between group">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      Approve Invoices
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </Button>
                </Link>
                <QuickTodoButton />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Summary */}
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
    // Re-throw Next.js redirect errors
    if (error && typeof error === 'object' && 'digest' in error && typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
      throw error
    }
    console.error("Error loading dashboard:", error)
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Unable to load dashboard data. Please try again later.</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              There was an error connecting to the database. Please check your connection and try again.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }
}
