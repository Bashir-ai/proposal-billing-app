export const dynamic = 'force-dynamic'
export const config = {
  maxDuration: 30, // seconds
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateProposalPdf, getLogoBase64 } from "@/lib/pdfkit-generator"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            name: true,
            company: true,
            email: true,
          },
        },
        lead: {
          select: {
            name: true,
            company: true,
            email: true,
          },
        },
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
        items: {
          orderBy: { createdAt: "asc" },
        },
        milestones: {
          orderBy: { dueDate: "asc" },
        },
        tags: true,
        paymentTerms: {
          where: {
            proposalItemId: null, // Only get proposal-level payment terms
          },
          orderBy: { createdAt: "asc" },
        },
      },
    })

    if (!proposal) {
      return new NextResponse("Proposal not found", { status: 404 })
    }

    // If token is provided, verify it matches (for public access)
    if (token && proposal.clientApprovalToken !== token) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    // Get logo
    const logoBase64 = await getLogoBase64()

    // Generate PDF using pdfkit
    try {
      const pdfBuffer = await generateProposalPdf(proposal, logoBase64)

      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="proposal-${proposal.proposalNumber || proposal.id}.pdf"`,
          'Cache-Control': 'public, max-age=3600',
        },
      })
    } catch (pdfError: any) {
      console.error("PDF generation error:", pdfError)
      return new NextResponse(
        `Failed to generate PDF: ${pdfError.message}`,
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("Error generating proposal PDF:", error)
    return new NextResponse(
      `Internal server error: ${error.message}`,
      { status: 500 }
    )
  }
}
