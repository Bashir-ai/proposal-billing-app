"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatDate } from "@/lib/utils"
import { ChevronDown, ChevronUp, FolderKanban, Receipt, Clock, DollarSign, CheckCircle2, AlertCircle, XCircle } from "lucide-react"

interface FinderClient {
  id: string
  name: string
  company: string | null
  finderFeePercent: number
  projects: Array<{
    id: string
    name: string
    status: string
    unbilledHours: number
    unbilledAmount: number
  }>
  invoices: Array<{
    id: string
    invoiceNumber: string | null
    amount: number
    status: string
    sentAt: string | null
    paidAt: string | null
    dueDate: string | null
  }>
  summary: {
    totalUnbilledHours: number
    totalUnbilledAmount: number
    openProjectsCount: number
    invoicesSent: number
    invoicesPaid: number
    invoicesOutstanding: number
  }
}

interface FinderClientsSectionProps {
  clients: FinderClient[]
  loading?: boolean
}

export function FinderClientsSection({ clients, loading }: FinderClientsSectionProps) {
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())

  const toggleClient = (clientId: string) => {
    const newExpanded = new Set(expandedClients)
    if (newExpanded.has(clientId)) {
      newExpanded.delete(clientId)
    } else {
      newExpanded.add(clientId)
    }
    setExpandedClients(newExpanded)
  }

  const getInvoiceStatusBadge = (status: string) => {
    const statusConfig = {
      PAID: { label: "Paid", className: "bg-green-100 text-green-800", icon: CheckCircle2 },
      SUBMITTED: { label: "Sent", className: "bg-blue-100 text-blue-800", icon: AlertCircle },
      APPROVED: { label: "Approved", className: "bg-yellow-100 text-yellow-800", icon: AlertCircle },
      DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-800", icon: XCircle },
      CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-800", icon: XCircle },
      WRITTEN_OFF: { label: "Written Off", className: "bg-red-100 text-red-800", icon: XCircle },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      className: "bg-gray-100 text-gray-800",
      icon: AlertCircle,
    }

    const Icon = config.icon

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${config.className}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">Loading finder clients...</div>
        </CardContent>
      </Card>
    )
  }

  if (clients.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">No finder clients found</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Finder Clients</h2>
      <p className="text-gray-600">Clients where you are listed as a finder</p>

      {clients.map((client) => {
        const isExpanded = expandedClients.has(client.id)

        return (
          <Card key={client.id} className="border-l-4 border-l-blue-500">
            <CardHeader
              className="cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleClient(client.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">
                    {client.name}
                    {client.company && <span className="text-gray-600 ml-2">({client.company})</span>}
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Finder Fee: {client.finderFeePercent}%
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Open Projects</div>
                    <div className="text-lg font-semibold">{client.summary.openProjectsCount}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Unbilled</div>
                    <div className="text-lg font-semibold">{formatCurrency(client.summary.totalUnbilledAmount)}</div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="space-y-6">
                {/* Summary Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <FolderKanban className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-gray-600">Open Projects</span>
                    </div>
                    <div className="text-xl font-bold text-blue-600">{client.summary.openProjectsCount}</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-orange-600" />
                      <span className="text-sm text-gray-600">Unbilled Hours</span>
                    </div>
                    <div className="text-xl font-bold text-orange-600">{client.summary.totalUnbilledHours.toFixed(1)}</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-purple-600" />
                      <span className="text-sm text-gray-600">Unbilled Amount</span>
                    </div>
                    <div className="text-xl font-bold text-purple-600">{formatCurrency(client.summary.totalUnbilledAmount)}</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Receipt className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-gray-600">Outstanding</span>
                    </div>
                    <div className="text-xl font-bold text-green-600">{client.summary.invoicesOutstanding}</div>
                  </div>
                </div>

                {/* Projects Section */}
                {client.projects.length > 0 ? (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <FolderKanban className="h-5 w-5" />
                      Open Projects ({client.projects.length})
                    </h3>
                    <div className="space-y-2">
                      {client.projects.map((project) => (
                        <div
                          key={project.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                        >
                          <div className="flex-1">
                            <div className="font-medium">{project.name}</div>
                            <div className="text-sm text-gray-600">
                              {project.unbilledHours.toFixed(1)} hours unbilled
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{formatCurrency(project.unbilledAmount)}</div>
                            <div className="text-xs text-gray-500">unbilled</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-4">No open projects</div>
                )}

                {/* Invoices Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Invoices
                    <span className="text-sm font-normal text-gray-600">
                      ({client.summary.invoicesSent} sent, {client.summary.invoicesPaid} paid, {client.summary.invoicesOutstanding} outstanding)
                    </span>
                  </h3>
                  {client.invoices.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="text-left p-2 text-sm font-medium">Invoice #</th>
                            <th className="text-left p-2 text-sm font-medium">Amount</th>
                            <th className="text-left p-2 text-sm font-medium">Status</th>
                            <th className="text-left p-2 text-sm font-medium">Sent</th>
                            <th className="text-left p-2 text-sm font-medium">Paid</th>
                            <th className="text-left p-2 text-sm font-medium">Due Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {client.invoices.map((invoice) => (
                            <tr key={invoice.id} className="border-b hover:bg-gray-50">
                              <td className="p-2 text-sm font-medium">
                                {invoice.invoiceNumber || `#${invoice.id.slice(0, 8)}`}
                              </td>
                              <td className="p-2 text-sm">{formatCurrency(invoice.amount)}</td>
                              <td className="p-2">{getInvoiceStatusBadge(invoice.status)}</td>
                              <td className="p-2 text-sm text-gray-600">
                                {invoice.sentAt ? formatDate(invoice.sentAt) : "-"}
                              </td>
                              <td className="p-2 text-sm text-gray-600">
                                {invoice.paidAt ? formatDate(invoice.paidAt) : "-"}
                              </td>
                              <td className="p-2 text-sm text-gray-600">
                                {invoice.dueDate ? formatDate(invoice.dueDate) : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-4">No invoices found</div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
