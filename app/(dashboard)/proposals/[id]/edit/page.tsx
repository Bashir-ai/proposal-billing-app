import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ProposalFormWrapper } from "@/components/proposals/ProposalFormWrapper"
import { redirect, notFound } from "next/navigation"

export default async function EditProposalPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect("/login")
  }

  if (session.user.role === "CLIENT") {
    redirect("/dashboard")
  }

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: {
      client: true,
      items: true,
    },
  })

  if (!proposal) {
    notFound()
  }

  if (proposal.status !== "DRAFT" || proposal.createdBy !== session.user.id) {
    redirect(`/dashboard/proposals/${id}`)
  }

  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      company: true,
    },
  })

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Edit Proposal</h1>
      <ProposalFormWrapper
        clients={clients}
        initialData={{
          ...proposal,
          items: proposal.items.map((item) => ({
            ...item,
            date: item.date ? item.date.toISOString().split("T")[0] : undefined,
          })),
        }}
        proposalId={id}
      />
    </div>
  )
}

