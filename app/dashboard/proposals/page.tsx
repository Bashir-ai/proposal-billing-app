"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { formatCurrency, formatDate } from "@/lib/utils"
import { ProposalStatus, ProposalType, ClientApprovalStatus } from "@prisma/client"

interface Proposal {
  id: string
  title: string
  description?: string | null
  status: ProposalStatus
  type: ProposalType
  clientApprovalStatus: ClientApprovalStatus
  amount?: number | null
  proposalNumber?: string | null
  createdAt: Date
  client: {
    id: string
    name: string
    company?: string | null
  }
  creator: {
    name: string
  }
  tags: Array<{ id: string; name: string; color?: string | null }>
  customTags: string[]
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [clientApprovalFilter, setClientApprovalFilter] = useState<string>("")
  const [clientFilter, setClientFilter] = useState<string>("")
  const [tagFilter, setTagFilter] = useState<string>("")
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([])
  const [tags, setTags] = useState<Array<{ id: string; name: string }>>([])

  // Read query parameters from URL on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const statusParam = params.get("status")
      const clientApprovalParam = params.get("clientApprovalStatus")
      
      if (statusParam && statusParam !== statusFilter) {
        setStatusFilter(statusParam)
      }
      if (clientApprovalParam && clientApprovalParam !== clientApprovalFilter) {
        setClientApprovalFilter(clientApprovalParam)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchProposals = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.append("status", statusFilter)
      if (clientApprovalFilter) params.append("clientApprovalStatus", clientApprovalFilter)
      if (clientFilter) params.append("clientId", clientFilter)
      if (tagFilter) params.append("tagId", tagFilter)

      const response = await fetch(`/api/proposals?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setProposals(data.filter((p: Proposal) => !p.deletedAt))
      }
    } catch (error) {
      console.error("Failed to fetch proposals:", error)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, clientApprovalFilter, clientFilter, tagFilter])

  const fetchClients = useCallback(async () => {
    try {
      const response = await fetch("/api/clients")
      if (response.ok) {
        const data = await response.json()
        setClients(data)
      }
    } catch (error) {
      console.error("Failed to fetch clients:", error)
    }
  }, [])

  const fetchTags = useCallback(async () => {
    try {
      const response = await fetch("/api/proposal-tags")
      if (response.ok) {
        const data = await response.json()
        setTags(data)
      }
    } catch (error) {
      console.error("Failed to fetch tags:", error)
    }
  }, [])

  useEffect(() => {
    fetchProposals()
    fetchClients()
    fetchTags()
  }, [fetchProposals, fetchClients, fetchTags])

  const filteredProposals = proposals.filter((proposal) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        proposal.title.toLowerCase().includes(query) ||
        proposal.description?.toLowerCase().includes(query) ||
        proposal.client.name.toLowerCase().includes(query) ||
        proposal.proposalNumber?.toLowerCase().includes(query) ||
        proposal.tags.some(tag => tag.name.toLowerCase().includes(query)) ||
        proposal.customTags.some(tag => tag.toLowerCase().includes(query))
      )
    }
    return true
  })

  const getStatusColor = (status: ProposalStatus) => {
    switch (status) {
      case "DRAFT":
        return "bg-gray-100 text-gray-800"
      case "SUBMITTED":
        return "bg-blue-100 text-blue-800"
      case "APPROVED":
        return "bg-green-100 text-green-800"
      case "REJECTED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getClientApprovalColor = (status: ClientApprovalStatus) => {
    switch (status) {
      case "APPROVED":
        return "bg-green-100 text-green-800"
      case "REJECTED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-yellow-100 text-yellow-800"
    }
  }

  const getTypeLabel = (type: ProposalType) => {
    switch (type) {
      case "FIXED_FEE":
        return "Fixed Fee"
      case "HOURLY":
        return "Hourly"
      case "RETAINER":
        return "Retainer"
      case "BLENDED_RATE":
        return "Blended Rate"
      case "SUCCESS_FEE":
        return "Success Fee"
      case "MIXED_MODEL":
        return "Mixed Model"
      case "CAPPED_FEE":
        return "Capped Fee" // Legacy - kept for backward compatibility
      case "LUMP_SUM":
        return "Lump Sum" // Legacy - kept for backward compatibility
      case "SUBJECT_BASIS":
        return "Subject Basis" // Legacy - kept for backward compatibility
      default:
        return type
    }
  }

  const clearFilters = () => {
    setStatusFilter("")
    setClientApprovalFilter("")
    setClientFilter("")
    setTagFilter("")
    setSearchQuery("")
  }

  const hasActiveFilters = statusFilter || clientApprovalFilter || clientFilter || tagFilter || searchQuery

  if (loading) {
    return <div>Loading proposals...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Proposals</h1>
          <p className="text-gray-600 mt-2">Manage your proposals</p>
        </div>
        <Link href="/dashboard/proposals/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Proposal
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search proposals..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </Select>

            <Select
              value={clientApprovalFilter}
              onChange={(e) => setClientApprovalFilter(e.target.value)}
            >
              <option value="">All Client Approvals</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </Select>

            <Select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            >
              <option value="">All Clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>

            <Select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            >
              <option value="">All Tags</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </Select>
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
              >
                <X className="h-4 w-4 mr-1" />
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredProposals.map((proposal) => (
          <Link key={proposal.id} href={`/dashboard/proposals/${proposal.id}`}>
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2 flex-wrap">
                      {proposal.proposalNumber && (
                        <span className="text-sm text-gray-600">#{proposal.proposalNumber}</span>
                      )}
                      <h3 className="text-lg font-semibold">{proposal.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(proposal.status)}`}>
                        {proposal.status}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getClientApprovalColor(proposal.clientApprovalStatus)}`}>
                        Client: {proposal.clientApprovalStatus}
                      </span>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {getTypeLabel(proposal.type)}
                      </span>
                      {proposal.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag.id}
                          className="px-2 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: tag.color ? `${tag.color}20` : "#3B82F620",
                            color: tag.color || "#3B82F6",
                          }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      Client: {proposal.client.name}
                      {proposal.client.company && ` (${proposal.client.company})`}
                    </p>
                    {proposal.description && (
                      <p className="text-sm text-gray-500 line-clamp-2">{proposal.description}</p>
                    )}
                    <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500">
                      <span>Created by {proposal.creator.name}</span>
                      <span>•</span>
                      <span>{formatDate(proposal.createdAt)}</span>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    {proposal.amount && (
                      <p className="text-xl font-bold">{formatCurrency(proposal.amount)}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {filteredProposals.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">
              {hasActiveFilters ? "No proposals match your filters" : "No proposals yet"}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            ) : (
              <Link href="/dashboard/proposals/new">
                <Button>Create Your First Proposal</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
