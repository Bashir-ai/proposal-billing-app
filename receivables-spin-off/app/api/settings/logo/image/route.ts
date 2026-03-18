export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Public endpoint to serve the logo image
export async function GET() {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: "app-settings" },
      select: { logoData: true, logoMimeType: true },
    })

    if (!settings?.logoData || !settings?.logoMimeType) {
      return new NextResponse(null, { status: 404 })
    }

    // Convert base64 back to buffer
    const buffer = Buffer.from(settings.logoData, "base64")

    // Return image with appropriate headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": settings.logoMimeType,
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error("Error serving logo:", error)
    return new NextResponse(null, { status: 500 })
  }
}
