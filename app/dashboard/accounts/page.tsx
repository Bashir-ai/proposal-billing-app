"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { formatCurrency, formatDate } from "@/lib/utils"
import Link from "next/link"
import { Calendar, DollarSign, TrendingUp } from "lucide-react"

interface FinderFee {
  id: string
  bill: {
    id: string
    invoiceNumber: string | null
    amount: number
    paidAt: string | null
  }
  client: {
    id: string
    name: string
    company: string | null
  }
  invoiceNetAmount: number
  finderFeePercent: number
  finderFeeAmount: number
  status: "PENDING" | "PARTIALLY_PAID" | "PAID"
  paidAmount: number
  remainingAmount: number
  earnedAt: string
  paidAt: string | null
  payments: Array<{
    id: string
    amount: number
    paymentDate: string
    notes: string | null
  }>
}

export default function AccountsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [finderFees, setFinderFees] = useState<FinderFee[]>([])
  const [selectedStatus, setSelectedStatus] = useState<string>("")
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([])
  const [stats, setStats] = useState({
    totalEarned: 0,
    totalPaid: 0,
    totalPending: 0,
  })
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])

  useEffect(() => {
    if (!session) return

    // If admin, fetch users list
    if (session.user.role === "ADMIN") {
      fetch("/api/users")
        .then((res) => res.json())
        .then((data) => {
          setUsers(data.filter((u: any) => u.role !== "CLIENT"))
          // Set to current user initially, or first user
          setSelectedUserId(session.user.id)
        })
        .catch(console.error)
    }

    // Fetch clients for filter
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => {
        setClients(data.map((c: any) => ({ id: c.id, name: c.name })))
      })
      .catch(console.error)
  }, [session])

  useEffect(() => {
    if (!session) return

    const targetUserId = session.user.role === "ADMIN" && selectedUserId ? selectedUserId : session.user.id

    setLoading(true)
    const params = new URLSearchParams()
    if (selectedStatus) params.set("status", selectedStatus)
    if (selectedClientId) params.set("clientId", selectedClientId)
    if (session.user.role === "ADMIN" && selectedUserId) {
      params.set("userId", selectedUserId)
    }

    fetch(`/api/finder-fees?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setFinderFees(data)
        // Calculate stats
        const totalEarned = data.reduce((sum: number, fee: FinderFee) => sum + fee.finderFeeAmount, 0)
        const totalPaid = data.reduce((sum: number, fee: FinderFee) => sum + fee.paidAmount, 0)
        const totalPending = data.reduce((sum: number, fee: FinderFee) => sum + fee.remainingAmount, 0)
        setStats({ totalEarned, totalPaid, totalPending })
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setLoading(false)
      })
  }, [session, selectedStatus, selectedClientId, selectedUserId])

  if (!session) {
    return <div>Loading...</div>
  }

  const isAdmin = session.user.role === "ADMIN"

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Finder Fee Accounts</h1>
          <p className="text-gray-600 mt-2">Track finder fees earned and paid</p>
        </div>
      </div>

      {/* User selector for admins */}
      {isAdmin && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">View Account For:</label>
              <Select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="min-w-[200px]"
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalEarned)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalPaid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalPending)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="text-sm font-medium mr-2">Status:</label>
              <Select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="">All</option>
                <option value="PENDING">Pending</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PAID">Paid</option>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mr-2">Client:</label>
              <Select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
              >
                <option value="">All Clients</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Finder Fees List */}
      <Card>
        <CardHeader>
          <CardTitle>Finder Fees</CardTitle>
          <CardDescription>All finder fees for this account</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Loading...</div>
          ) : finderFees.length === 0 ? (
            <p className="text-gray-500">No finder fees found</p>
          ) : (
            <div className="space-y-4">
              {finderFees.map((fee) => (
                <Card key={fee.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <Link
                            href={`/dashboard/bills/${fee.bill.id}`}
                            className="font-semibold text-blue-600 hover:underline"
                          >
                            Invoice: {fee.bill.invoiceNumber || fee.bill.id}
                          </Link>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              fee.status === "PAID"
                                ? "bg-green-100 text-green-800"
                                : fee.status === "PARTIALLY_PAID"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {fee.status.replace("_", " ")}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          <Link
                            href={`/dashboard/clients/${fee.client.id}`}
                            className="hover:underline"
                          >
                            Client: {fee.client.name}
                            {fee.client.company && ` (${fee.client.company})`}
                          </Link>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Fee Amount:</span>
                            <div className="font-semibold">{formatCurrency(fee.finderFeeAmount)}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Paid:</span>
                            <div className="font-semibold">{formatCurrency(fee.paidAmount)}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Remaining:</span>
                            <div className="font-semibold">{formatCurrency(fee.remainingAmount)}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Earned At:</span>
                            <div className="font-semibold">{formatDate(fee.earnedAt)}</div>
                          </div>
                        </div>
                        {fee.payments && fee.payments.length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <div className="text-sm font-medium mb-2">Payment History:</div>
                            <div className="space-y-2">
                              {fee.payments.map((payment) => (
                                <div key={payment.id} className="flex justify-between text-sm">
                                  <span>{formatDate(payment.paymentDate)}</span>
                                  <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                                  {payment.notes && (
                                    <span className="text-gray-500"> - {payment.notes}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {isAdmin && fee.status !== "PAID" && (
                        <Link href={`/dashboard/accounts/${fee.id}/pay`}>
                          <Button variant="outline" size="sm">
                            Record Payment
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}




