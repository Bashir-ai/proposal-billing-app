import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { DashboardNav } from "@/components/shared/DashboardNav"

export const dynamic = 'force-dynamic'

export default async function ProjectsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      redirect("/login")
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNav user={session.user} />
        <main className="container mx-auto py-8 px-4">
          {children}
        </main>
      </div>
    )
  } catch (error) {
    console.error("Error in projects layout:", error)
    redirect("/login")
  }
}





