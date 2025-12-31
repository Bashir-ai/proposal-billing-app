import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { DashboardNav } from "@/components/shared/DashboardNav"

export default async function DashboardLayout({
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
    // If there's an error (e.g., database connection, missing env vars),
    // redirect to login page as fallback
    console.error("Error in dashboard layout:", error)
    redirect("/login")
  }
}
