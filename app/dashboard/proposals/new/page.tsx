import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ProposalFormWrapper } from "@/components/proposals/ProposalFormWrapper"
import { redirect } from "next/navigation"

export default async function NewProposalPage() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect("/login")
  }

  if (session.user.role === "CLIENT") {
    redirect("/dashboard")
  }

  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
  })

  const users = await prisma.user.findMany({
    where: {
      role: {
        in: ["ADMIN", "MANAGER", "STAFF"],
      },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      defaultHourlyRate: true,
    },
  })

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Create New Proposal</h1>
      <ProposalFormWrapper clients={clients} users={users} />
    </div>
  )
}
