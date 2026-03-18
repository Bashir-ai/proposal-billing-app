import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ProjectForm } from "@/components/projects/ProjectForm"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function ProjectEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  if (!session) {
    notFound()
  }

  // Check permissions
  if (session.user.role === "CLIENT") {
    notFound()
  }

  const project = await prisma.project.findUnique({
    where: {
      id,
      deletedAt: null,
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          company: true,
        },
      },
      proposal: {
        select: {
          id: true,
          type: true,
          useBlendedRate: true,
          blendedRate: true,
          hourlyRateTableType: true,
          hourlyRateTableRates: true,
          hourlyRateRangeMin: true,
          hourlyRateRangeMax: true,
        },
      },
      projectManagers: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      },
      userRates: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              profile: true,
              defaultHourlyRate: true,
            },
          },
        },
      },
    },
  })

  if (!project) {
    notFound()
  }

  // Fetch all users for the billing configuration
  const users = await prisma.user.findMany({
    where: {
      role: {
        not: "CLIENT",
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      profile: true,
      defaultHourlyRate: true,
    },
    orderBy: {
      name: "asc",
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href={`/dashboard/projects/${id}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Edit Project</h1>
        </div>
      </div>

      <ProjectForm
        projectId={id}
        initialData={{
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          startDate: project.startDate?.toISOString() || null,
          endDate: project.endDate?.toISOString() || null,
          currency: project.currency,
          useBlendedRate: project.useBlendedRate,
          blendedRate: project.blendedRate,
          hourlyRateTableType: project.hourlyRateTableType,
          hourlyRateTableRates: project.hourlyRateTableRates,
          hourlyRateRangeMin: project.hourlyRateRangeMin,
          hourlyRateRangeMax: project.hourlyRateRangeMax,
          projectManagers: project.projectManagers,
          userRates: project.userRates,
          proposal: project.proposal,
        }}
        users={users}
      />
    </div>
  )
}
