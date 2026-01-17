import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"
import { LeadSearch } from "@/components/leads/LeadSearch"
import { Suspense } from "react"
import { UserRole } from "@prisma/client"
import { LeadsList } from "@/components/leads/LeadsList"

export const dynamic = 'force-dynamic'

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    status?: string
    areaOfLawId?: string
    sectorOfActivityId?: string
    search?: string
    archived?: string
  }>
}) {
  const session = await getServerSession(authOptions)
  const params = await searchParams
  
  if (!session || !session.user) {
    return <div>Please log in to view leads.</div>
  }
  
  if (session.user.role === UserRole.CLIENT) {
    return <div>Access denied</div>
  }

  const searchQuery = params?.search || ""
  const statusFilter = params?.status
  const areaOfLawIdFilter = params?.areaOfLawId
  const sectorOfActivityIdFilter = params?.sectorOfActivityId
  const showArchived = params?.archived === "true"

  // Build where clause
  const where: any = {
    deletedAt: null,
  }

  if (!showArchived) {
    where.archivedAt = null
  }

  if (searchQuery) {
    where.OR = [
      { name: { contains: searchQuery, mode: "insensitive" } },
      { email: { contains: searchQuery, mode: "insensitive" } },
      { company: { contains: searchQuery, mode: "insensitive" } },
    ]
  }

  if (statusFilter) {
    where.status = statusFilter
  }

  if (areaOfLawIdFilter) {
    where.areaOfLawId = areaOfLawIdFilter
  }

  if (sectorOfActivityIdFilter) {
    where.sectorOfActivityId = sectorOfActivityIdFilter
  }

  // Fetch leads
  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      leadManager: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      areaOfLaw: {
        select: {
          id: true,
          name: true,
        },
      },
      sectorOfActivity: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          interactions: true,
          todos: true,
          proposals: true,
        },
      },
    },
  })

  // Fetch statistics
  const totalLeads = await prisma.lead.count({
    where: {
      deletedAt: null,
      archivedAt: null,
    },
  })
  
  const leadsByStatus = await prisma.lead.groupBy({
    by: ["status"],
    where: {
      deletedAt: null,
      archivedAt: null,
    },
    _count: {
      id: true,
    },
  })
  
  const convertedLeads = await prisma.lead.count({
    where: {
      deletedAt: null,
      status: "CONVERTED",
    },
  })
  
  const areasOfLaw = await prisma.areaOfLaw.findMany({
    orderBy: { name: "asc" },
  })
  
  const sectorsOfActivity = await prisma.sectorOfActivity.findMany({
    orderBy: { name: "asc" },
  })

  const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : "0"

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-gray-600 mt-2">Manage and track potential clients</p>
        </div>
        <Link href="/dashboard/leads/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add New Lead
          </Button>
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Converted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{convertedLeads}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Conversion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              New Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leadsByStatus.find((s) => s.status === "NEW")?._count.id || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <Suspense fallback={<div>Loading filters...</div>}>
            <LeadSearch
              areasOfLaw={areasOfLaw}
              sectorsOfActivity={sectorsOfActivity}
              initialStatus={statusFilter}
              initialAreaOfLawId={areaOfLawIdFilter}
              initialSectorOfActivityId={sectorOfActivityIdFilter}
              initialSearch={searchQuery}
              showArchived={showArchived}
            />
          </Suspense>
        </CardContent>
      </Card>

      {/* Leads List */}
      <LeadsList leads={leads} isAdmin={session.user.role === "ADMIN"} />
    </div>
  )
}
