import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, Upload } from "lucide-react"
import { isClientActive } from "@/lib/client-activity"
import { ClientSearch } from "@/components/clients/ClientSearch"
import { ClientsList } from "@/components/clients/ClientsList"

export const dynamic = 'force-dynamic'

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ active?: string; search?: string; sort?: string }>
}) {
  try {
    const session = await getServerSession(authOptions)
    const params = await searchParams
    const activeParam = params?.active
    const searchQuery = params?.search || ""
    const sortParam = params?.sort || "name" // Default to "name"
    
    if (!session || !session.user) {
      return <div>Please log in to view clients.</div>
    }
    
    if (session.user.role === "CLIENT") {
      return <div>Access denied</div>
    }

    // Build where clause for search
    const where: any = {
      deletedAt: null, // Exclude deleted clients
      archivedAt: null, // Exclude archived clients
    }
    if (searchQuery) {
      where.OR = [
        { name: { contains: searchQuery, mode: "insensitive" } },
        { email: { contains: searchQuery, mode: "insensitive" } },
        { company: { contains: searchQuery, mode: "insensitive" } },
        { fullLegalName: { contains: searchQuery, mode: "insensitive" } },
      ]
    }

    const allClients = await prisma.client.findMany({
      where,
      include: {
        _count: {
          select: {
            proposals: {
              where: {
                deletedAt: null, // Exclude soft-deleted proposals
              },
            },
            bills: {
              where: {
                deletedAt: null, // Exclude soft-deleted bills
              },
            },
            projects: {
              where: {
                deletedAt: null, // Exclude soft-deleted projects
              },
            },
          },
        },
        projects: {
          where: {
            deletedAt: null,
            status: "ACTIVE",
          },
          select: {
            id: true,
          },
        },
      },
    })

    // Get ongoing todos count per client (todos linked to client's projects or proposals)
    const clientIds = allClients.map(c => c.id)
    
    // Get todos with their related project/proposal client IDs
    const ongoingTodos = await prisma.todo.findMany({
      where: {
        status: {
          in: ['PENDING', 'IN_PROGRESS'],
        },
        OR: [
          {
            project: {
              clientId: { in: clientIds },
            },
          },
          {
            proposal: {
              clientId: { in: clientIds },
            },
          },
        ],
      },
      include: {
        project: {
          select: { clientId: true },
        },
        proposal: {
          select: { clientId: true },
        },
      },
    })

    // Map todos to clients
    const todosByClient = new Map<string, number>()
    for (const todo of ongoingTodos) {
      const clientId = todo.project?.clientId || todo.proposal?.clientId
      if (clientId) {
        const current = todosByClient.get(clientId) || 0
        todosByClient.set(clientId, current + 1)
      }
    }

    // Filter by activity if requested
    let clients = allClients
    if (activeParam !== undefined) {
      const isActiveFilter = activeParam === "true"
      const activityPromises = allClients.map(client => isClientActive(client.id))
      const activityResults = await Promise.all(activityPromises)
      
      clients = allClients.filter((client, index) => {
        const isActive = activityResults[index]
        return isActiveFilter ? isActive : !isActive
      })
    }

    // Apply sorting
    if (sortParam === "most-used") {
      clients.sort((a, b) => {
        const aActiveProjects = a.projects.length
        const bActiveProjects = b.projects.length
        const aOngoingTodos = todosByClient.get(a.id) || 0
        const bOngoingTodos = todosByClient.get(b.id) || 0
        const aTotal = aActiveProjects + aOngoingTodos
        const bTotal = bActiveProjects + bOngoingTodos
        return bTotal - aTotal // Descending order (most used first)
      })
    } else if (sortParam === "name") {
      clients.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortParam === "number") {
      // Extract numeric portion from client name
      const extractNumber = (name: string): number => {
        // Try to find number at the end after a separator (e.g., "Client Name - 123" or "Client #456")
        const match = name.match(/(?:[-#]\s*)?(\d+)$/)
        if (match) {
          return parseInt(match[1], 10)
        }
        // If no number found, return a large number to sort to the end
        return Infinity
      }
      clients.sort((a, b) => {
        const aNum = extractNumber(a.name)
        const bNum = extractNumber(b.name)
        if (aNum === Infinity && bNum === Infinity) {
          // Both have no number, sort alphabetically
          return a.name.localeCompare(b.name)
        }
        if (aNum === Infinity) return 1 // a goes to end
        if (bNum === Infinity) return -1 // b goes to end
        return aNum - bNum
      })
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Clients</h1>
            <p className="text-gray-600 mt-2">Manage your clients</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/clients/import">
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Import Clients
              </Button>
            </Link>
            <Link href="/dashboard/clients/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Client
              </Button>
            </Link>
          </div>
        </div>

        <div className="mb-4">
          <ClientSearch />
          {activeParam !== undefined && (
            <div className="mt-2 text-sm text-gray-600">
              Filtered by: {activeParam === "true" ? "Active clients" : "Non-active clients"}
            </div>
          )}
          {searchQuery && (
            <div className="mt-2 text-sm text-gray-600">
              Search results for: &quot;{searchQuery}&quot;
            </div>
          )}
        </div>

        <ClientsList 
          clients={clients} 
          isAdmin={session.user.role === "ADMIN"} 
        />
        {/* Debug: Remove after testing */}
        {process.env.NODE_ENV === "development" && (
          <div className="hidden">
            Debug - User role: {session.user.role}, isAdmin: {String(session.user.role === "ADMIN")}
          </div>
        )}

        {clients.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500 mb-4">No clients yet</p>
              <Link href="/dashboard/clients/new">
                <Button>Add Your First Client</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    )
  } catch (error) {
    console.error("Error loading clients:", error)
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Error Loading Clients</h1>
        <p className="text-red-600">{(error as Error).message}</p>
        <p className="text-sm text-gray-500 mt-2">Check the terminal for more details.</p>
      </div>
    )
  }
}
