import { redirect } from "next/navigation"

export default function Home() {
  // Use server-side redirect - simpler and more reliable
  // This will always work and doesn't depend on any client-side code
  redirect("/login")
}




