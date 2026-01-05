import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Edit, Archive, Trash2 } from "lucide-react"
import { LeadStatusBadge } from "@/components/leads/LeadStatusBadge"
import { LeadInteractionTimeline } from "@/components/leads/LeadInteractionTimeline"
import { QuickInteractionButton } from "@/components/leads/QuickInteractionButton"
import { ConvertLeadDialog } from "@/components/leads/ConvertLeadDialog"
import { InteractionType } from "@prisma/client"
import { LeadDetailClient } from "./LeadDetailClient"

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  if (!session || !session.user) {
    return <div>Please log in to view leads.</div>
  }

  if (session.user.role === "CLIENT") {
    return <div>Access denied</div>
  }

  const lead = await prisma.lead.findUnique({
    where: {
      id,
      deletedAt: null,
    },
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
          description: true,
        },
      },
      sectorOfActivity: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
      interactions: {
        orderBy: { date: "desc" },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      todos: {
        where: {
          status: {
            not: "COMPLETED",
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      proposals: {
        where: {
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      convertedToClient: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!lead) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Lead Not Found</h1>
        <Card>
          <CardContent className="p-6">
            <p>The lead you're looking for doesn't exist or has been deleted.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <LeadDetailClient lead={lead} session={session} />
}

