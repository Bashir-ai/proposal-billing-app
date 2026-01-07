import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admin can access junk box
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden. Only admins can access the junk box." },
        { status: 403 }
      )
    }

    // Fetch all deleted items
    const [deletedProposals, deletedProjects, deletedBills] = await Promise.all([
      prisma.proposal.findMany({
        where: {
          deletedAt: { not: null },
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              company: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { deletedAt: "desc" },
      }),
      prisma.project.findMany({
        where: {
          deletedAt: { not: null },
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              company: true,
            },
          },
          proposal: {
            select: {
              id: true,
              title: true,
              proposalNumber: true,
            },
          },
        },
        orderBy: { deletedAt: "desc" },
      }),
      prisma.bill.findMany({
        where: {
          deletedAt: { not: null },
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              company: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          proposal: {
            select: {
              id: true,
              title: true,
              proposalNumber: true,
            },
          },
        },
        orderBy: { deletedAt: "desc" },
      }),
    ])

    return NextResponse.json({
      proposals: deletedProposals,
      projects: deletedProjects,
      bills: deletedBills,
    })
  } catch (error: any) {
    console.error("Error fetching junk box:", error)
    
    // Check if it's a Prisma schema error (missing columns)
    if (error?.code?.startsWith("P") || error?.message?.includes("Unknown column") || error?.message?.includes("deletedAt")) {
      return NextResponse.json(
        { 
          error: "Database schema mismatch. Please run 'npx prisma db push' to update the database schema.",
          details: error.message
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error?.message || String(error)
      },
      { status: 500 }
    )
  }
}

