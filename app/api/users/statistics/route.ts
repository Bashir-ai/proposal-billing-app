import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { calculateAllUsersStatistics } from "@/lib/user-statistics"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can view all users statistics
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined

    const statistics = await calculateAllUsersStatistics({
      startDate,
      endDate,
    })

    return NextResponse.json(statistics)
  } catch (error) {
    console.error("Error calculating all users statistics:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}



