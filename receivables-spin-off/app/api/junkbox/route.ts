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

    // Fetch all deleted items with optimized queries and null safety
    const [deletedProposals, deletedProjects, deletedBills] = await Promise.all([
      prisma.proposal.findMany({
        where: {
          deletedAt: { not: null },
        },
        select: {
          id: true,
          title: true,
          proposalNumber: true,
          deletedAt: true,
          clientId: true,
          createdBy: true,
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
        take: 100, // Limit to prevent performance issues
      }),
      prisma.project.findMany({
        where: {
          deletedAt: { not: null },
        },
        select: {
          id: true,
          name: true,
          deletedAt: true,
          clientId: true,
          proposalId: true,
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
        take: 100, // Limit to prevent performance issues
      }),
      prisma.bill.findMany({
        where: {
          deletedAt: { not: null },
        },
        select: {
          id: true,
          invoiceNumber: true,
          amount: true,
          deletedAt: true,
          clientId: true,
          leadId: true,
          createdBy: true,
          proposalId: true,
          client: {
            select: {
              id: true,
              name: true,
              company: true,
            },
          },
          lead: {
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
        take: 100, // Limit to prevent performance issues
      }),
    ])

    // Filter out items with missing required relations and format dates
    const formatProposals = deletedProposals
      .filter(p => p.client && p.creator) // Only include proposals with valid relations
      .map(p => ({
        id: p.id,
        title: p.title || "Untitled Proposal",
        proposalNumber: p.proposalNumber,
        deletedAt: p.deletedAt?.toISOString() || new Date().toISOString(),
        client: p.client ? {
          name: p.client.name || "Unknown Client",
          company: p.client.company,
        } : { name: "Unknown Client", company: null },
        creator: p.creator ? {
          name: p.creator.name || "Unknown User",
        } : { name: "Unknown User" },
      }))

    const formatProjects = deletedProjects
      .filter(p => p.client) // Only include projects with valid client
      .map(p => ({
        id: p.id,
        name: p.name || "Unnamed Project",
        deletedAt: p.deletedAt?.toISOString() || new Date().toISOString(),
        client: p.client ? {
          name: p.client.name || "Unknown Client",
          company: p.client.company,
        } : { name: "Unknown Client", company: null },
        proposal: p.proposal ? {
          title: p.proposal.title || "Unknown Proposal",
          proposalNumber: p.proposal.proposalNumber,
        } : null,
      }))

    const formatBills = deletedBills
      .filter(b => (b.client || b.lead) && b.creator) // Only include bills with valid relations (client or lead)
      .map(b => ({
        id: b.id,
        invoiceNumber: b.invoiceNumber,
        amount: b.amount || 0,
        deletedAt: b.deletedAt?.toISOString() || new Date().toISOString(),
        client: b.client ? {
          name: b.client.name || "Unknown Client",
          company: b.client.company,
        } : null,
        lead: b.lead ? {
          name: b.lead.name || "Unknown Lead",
          company: b.lead.company,
        } : null,
        creator: b.creator ? {
          name: b.creator.name || "Unknown User",
        } : { name: "Unknown User" },
        proposal: b.proposal ? {
          title: b.proposal.title || "Unknown Proposal",
          proposalNumber: b.proposal.proposalNumber,
        } : null,
      }))

    return NextResponse.json({
      proposals: formatProposals,
      projects: formatProjects,
      bills: formatBills,
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

