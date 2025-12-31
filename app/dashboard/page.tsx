import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FileText, Receipt, Users, TrendingUp } from "lucide-react"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  const [proposalsCount, billsCount, clientsCount, totalRevenue] = await Promise.all([
    prisma.proposal.count({
      where: session?.user.role === "CLIENT" 
        ? { client: { email: session?.user.email } }
        : undefined
    }),
    prisma.bill.count({
      where: session?.user.role === "CLIENT"
        ? { client: { email: session?.user.email } }
        : undefined
    }),
    prisma.client.count(),
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
  ])

  const stats = [
    {
      name: "Proposals",
      value: proposalsCount,
      icon: FileText,
      href: "/dashboard/proposals",
      color: "text-blue-600",
    },
    {
      name: "Bills",
      value: billsCount,
      icon: Receipt,
      href: "/dashboard/bills",
      color: "text-green-600",
    },
    {
      name: "Clients",
      value: clientsCount,
      icon: Users,
      href: "/dashboard/clients",
      color: "text-purple-600",
    },
    {
      name: "Total Revenue",
      value: formatCurrency(totalRevenue._sum.amount || 0),
      icon: TrendingUp,
      href: "/dashboard/bills",
      color: "text-orange-600",
    },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome back, {session?.user.name}</p>
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

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  Create New Bill
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
