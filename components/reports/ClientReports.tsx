"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatCurrency, formatDate } from "@/lib/utils"
import { FinancialSummary } from "@/components/dashboard/FinancialSummary"
import { Clock, Users, FolderKanban, CheckSquare, Receipt, FileText } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ClientStatistics {
  clientId: string
  clientName: string
  clientEmail: string | null
  todosTotal: number
  todosOngoing: number
  todosCompleted: number
  totalHours: number
  projectsCount: number
  proposalsCount: number
  invoicesCount: number
  totalRevenue: number
  invoicedNotPaid: number
  unbilledWork?: {
    timesheetHours: number
    totalAmount: number
  }
  closedProposalsNotCharged?: number
}

export function ClientReports() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [statistics, setStatistics] = useState<ClientStatistics[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [allClients, setAllClients] = useState<Array<{ id: string; name: string; email: string | null }>>([])
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")

  // Fetch clients list for dropdown
  useEffect(() => {
    if (!session) return
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => {
        setAllClients(data.map((c: any) => ({ id: c.id, name: c.name, email: c.email })))
      })
      .catch(console.error)
  }, [session])

  // Fetch statistics
  useEffect(() => {
    if (!session) return

    setLoading(true)
    const params = new URLSearchParams()
    if (startDate) params.set("startDate", startDate)
    if (endDate) params.set("endDate", endDate)

    if (selectedClientId) {
      // Fetch individual client statistics with full details
      fetch(`/api/clients/${selectedClientId}/statistics?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => {
          setStatistics([data])
          setLoading(false)
        })
        .catch((err) => {
          console.error(err)
          setLoading(false)
        })
    } else {
      // Fetch all clients statistics
      fetch(`/api/clients/statistics?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => {
          setStatistics(data)
          setLoading(false)
        })
        .catch((err) => {
          console.error(err)
          setLoading(false)
        })
    }
  }, [session, startDate, endDate, selectedClientId])

  if (!session) {
    return <div>Loading...</div>
  }

  return (
    <div>
      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <Label className="text-sm font-medium mr-2">Client:</Label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="border rounded px-2 py-1"
              >
                <option value="">All Clients</option>
                {allClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} {client.email ? `(${client.email})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-sm font-medium mr-2">Start Date:</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-auto"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mr-2">End Date:</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-auto"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div>Loading...</div>
      ) : statistics.length === 0 ? (
        <p className="text-gray-500">No statistics found</p>
      ) : (
        <div className="space-y-6">
          {statistics.map((stats) => (
            <div key={stats.clientId} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{stats.clientName}</CardTitle>
                  <CardDescription>{stats.clientEmail || "No email"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                    {/* Todos */}
                    <div className="space-y-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <CheckSquare className="h-4 w-4" />
                        Todos
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total:</span>
                          <span className="font-semibold">{stats.todosTotal}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Ongoing:</span>
                          <span className="font-semibold">{stats.todosOngoing}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Completed:</span>
                          <span className="font-semibold">{stats.todosCompleted}</span>
                        </div>
                      </div>
                    </div>

                    {/* Hours */}
                    <div className="space-y-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Hours
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Hours:</span>
                          <span className="font-semibold">{stats.totalHours.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Projects */}
                    <div className="space-y-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <FolderKanban className="h-4 w-4" />
                        Projects
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Projects:</span>
                          <span className="font-semibold">{stats.projectsCount}</span>
                        </div>
                      </div>
                    </div>

                    {/* Proposals */}
                    <div className="space-y-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Proposals
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Proposals:</span>
                          <span className="font-semibold">{stats.proposalsCount}</span>
                        </div>
                      </div>
                    </div>

                    {/* Invoices */}
                    <div className="space-y-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Receipt className="h-4 w-4" />
                        Invoices
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Invoices:</span>
                          <span className="font-semibold">{stats.invoicesCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Financial Summary */}
                  {stats.unbilledWork !== undefined && stats.closedProposalsNotCharged !== undefined && (
                    <div className="mt-6">
                      <FinancialSummary
                        totalRevenue={stats.totalRevenue}
                        invoicedNotPaid={stats.invoicedNotPaid}
                        closedProposalsNotCharged={stats.closedProposalsNotCharged}
                        unbilledWork={{
                          timesheetHours: stats.unbilledWork.timesheetHours,
                          totalAmount: stats.unbilledWork.totalAmount,
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
