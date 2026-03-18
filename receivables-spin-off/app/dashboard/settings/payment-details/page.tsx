import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PaymentDetailsClient } from "./PaymentDetailsClient"

export const dynamic = 'force-dynamic'

export default async function PaymentDetailsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect("/login")
  }

  // Only admins and managers can access this page
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    redirect("/dashboard")
  }

  return <PaymentDetailsClient />
}


