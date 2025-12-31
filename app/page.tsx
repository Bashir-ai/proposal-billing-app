import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export default async function Home() {
  try {
    const session = await getServerSession(authOptions)
    
    if (session) {
      redirect("/dashboard")
    } else {
      redirect("/login")
    }
  } catch (error) {
    // If there's an error (e.g., database connection, missing env vars),
    // redirect to login page as fallback
    console.error("Error checking session:", error)
    redirect("/login")
  }
}




