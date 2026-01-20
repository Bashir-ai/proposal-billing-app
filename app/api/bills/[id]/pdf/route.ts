export const dynamic = 'force-dynamic'
export const maxDuration = 30 // seconds

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateInvoicePdf, getLogoBase64 } from "@/lib/pdfkit-generator"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const bill = await prisma.bill.findUnique({
      where: { id },
      include: {
        client: true,
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            person: {
              select: {
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        proposal: {
          select: {
            id: true,
            title: true,
            proposalNumber: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
        paymentDetails: {
          select: {
            id: true,
            name: true,
            details: true,
          },
        },
      },
    })

    if (!bill) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Check if client can access this invoice
    if (session.user.role === "CLIENT") {
      const client = await prisma.client.findFirst({
        where: { 
          email: session.user.email,
          deletedAt: null,
        },
      })
      if (!client || bill.clientId !== client.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Get logo
    const logoBase64 = await getLogoBase64()

    // Generate PDF using pdfkit
    try {
      const pdfBuffer = await generateInvoicePdf(bill, logoBase64)

      const filename = bill.invoiceNumber 
        ? `invoice-${bill.invoiceNumber}.pdf`
        : `invoice-${bill.id}.pdf`

      return new NextResponse(pdfBuffer as any, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    } catch (pdfError: any) {
      console.error("PDF generation error:", pdfError)
      return NextResponse.json(
        { error: "Internal server error", message: pdfError.message },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("Error generating PDF:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}
