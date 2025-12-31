import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

export default async function ClientsPage() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return <div>Please log in to view clients.</div>
    }
    
    if (session.user.role === "CLIENT") {
      return <div>Access denied</div>
    }

    const clients = await prisma.client.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            proposals: true,
            bills: true,
          },
        },
      },
    })

    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Clients</h1>
            <p className="text-gray-600 mt-2">Manage your clients</p>
          </div>
          <Link href="/dashboard/clients/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </Link>
        </div>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search clients..."
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map((client) => (
            <Link key={client.id} href={`/dashboard/clients/${client.id}`}>
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle>{client.name}</CardTitle>
                  {client.company && (
                    <p className="text-sm text-gray-600">{client.company}</p>
                  )}
                </CardHeader>
                <CardContent>
                  {client.email && (
                    <p className="text-sm text-gray-600 mb-2">{client.email}</p>
                  )}
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>{client._count.proposals} proposals</span>
                    <span>{client._count.bills} bills</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

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
