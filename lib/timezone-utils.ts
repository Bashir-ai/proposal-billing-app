import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * Get the user's timezone from the database
 * @param userId - User ID
 * @returns User's timezone or "UTC" as default
 */
export async function getUserTimezone(userId: string): Promise<string> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    })
    return user?.timezone || "UTC"
  } catch (error) {
    console.error("Error fetching user timezone:", error)
    return "UTC"
  }
}

/**
 * Get the current user's timezone from session
 * @returns User's timezone or "UTC" as default
 */
export async function getCurrentUserTimezone(): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return "UTC"
  }
  return getUserTimezone(session.user.id)
}
