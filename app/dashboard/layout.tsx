import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { DashboardShell } from "@/components/shared/DashboardShell"

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
      <DashboardShell user={session.user}>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <div id="main-content" role="main" aria-label="Main content">
          {children}
        </div>
      </DashboardShell>
    )
  } catch (error) {
    // If there's an error (e.g., database connection, missing env vars),
    // redirect to login page as fallback
    console.error("Error in dashboard layout:", error)
    redirect("/login")
  }
}
