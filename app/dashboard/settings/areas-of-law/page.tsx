import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AreasOfLawClient } from "./AreasOfLawClient"

export default async function AreasOfLawPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect("/login")
  }

  if (session.user.role !== "ADMIN") {
    return (
      <div className="container mx-auto py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-center text-gray-500">Access denied. Admin only.</p>
        </div>
      </div>
    )
  }

  return <AreasOfLawClient />
}

