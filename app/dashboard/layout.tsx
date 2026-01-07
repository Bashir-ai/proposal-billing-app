import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { DashboardNav } from "@/components/shared/DashboardNav"

export const dynamic = 'force-dynamic'

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
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <DashboardNav user={session.user} />
        <main id="main-content" className="container mx-auto py-8 px-4" role="main" aria-label="Main content">
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
