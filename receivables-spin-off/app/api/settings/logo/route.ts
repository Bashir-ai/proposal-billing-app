export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"]
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB (smaller for base64 storage)

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const settings = await prisma.settings.findUnique({
      where: { id: "app-settings" },
    })

    // Return data URL if logo exists in database
    if (settings?.logoData && settings?.logoMimeType) {
      return NextResponse.json({ 
        logoPath: `/api/settings/logo/image`,
        hasLogo: true 
      })
    }

    return NextResponse.json({ logoPath: null, hasLogo: false })
  } catch (error) {
    console.error("Error fetching logo:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get("logo") as File | null

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PNG, JPG, JPEG, SVG" },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 2MB limit" },
        { status: 400 }
      )
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Data = buffer.toString("base64")

    // Store in database
    const settings = await prisma.settings.upsert({
      where: { id: "app-settings" },
      update: {
        logoData: base64Data,
        logoMimeType: file.type,
        logoPath: `/api/settings/logo/image`, // Virtual path for serving
        updatedBy: session.user.id,
      },
      create: {
        id: "app-settings",
        logoData: base64Data,
        logoMimeType: file.type,
        logoPath: `/api/settings/logo/image`,
        updatedBy: session.user.id,
      },
    })

    return NextResponse.json({
      success: true,
      logoPath: settings.logoPath,
    })
  } catch (error) {
    console.error("Error uploading logo:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      )
    }

    await prisma.settings.update({
      where: { id: "app-settings" },
      data: {
        logoData: null,
        logoMimeType: null,
        logoPath: null,
        updatedBy: session.user.id,
      },
    })

    return NextResponse.json({ success: true, message: "Logo deleted" })
  } catch (error) {
    console.error("Error deleting logo:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
