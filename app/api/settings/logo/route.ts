import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { writeFile, unlink } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"]
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "logos")

// WARNING: File system writes will NOT work on Vercel (read-only filesystem)
// For production deployment on Vercel, you need to use cloud storage:
// - Vercel Blob Storage: https://vercel.com/docs/storage/vercel-blob
// - AWS S3
// - Cloudinary
// - Or any other cloud storage solution

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const settings = await prisma.settings.findUnique({
      where: { id: "app-settings" },
    })

    return NextResponse.json({ logoPath: settings?.logoPath || null })
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
        { error: "File size exceeds 5MB limit" },
        { status: 400 }
      )
    }

    // Get file extension
    const extension = file.name.split(".").pop()?.toLowerCase() || "png"
    const fileName = `logo.${extension}`
    const filePath = join(UPLOAD_DIR, fileName)

    // Read file buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Get existing settings to check for old logo
    const existingSettings = await prisma.settings.findUnique({
      where: { id: "app-settings" },
    })

    // Delete old logo if it exists and is different
    if (existingSettings?.logoPath) {
      const oldFilePath = join(process.cwd(), "public", existingSettings.logoPath)
      if (existsSync(oldFilePath) && oldFilePath !== filePath) {
        try {
          await unlink(oldFilePath)
        } catch (error) {
          console.error("Error deleting old logo:", error)
          // Continue even if deletion fails
        }
      }
    }

    // Write new file
    await writeFile(filePath, buffer)

    // Update or create settings record
    const logoPath = `/uploads/logos/${fileName}`
    const settings = await prisma.settings.upsert({
      where: { id: "app-settings" },
      update: {
        logoPath,
        updatedBy: session.user.id,
      },
      create: {
        id: "app-settings",
        logoPath,
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

    const settings = await prisma.settings.findUnique({
      where: { id: "app-settings" },
    })

    if (settings?.logoPath) {
      const filePath = join(process.cwd(), "public", settings.logoPath)
      if (existsSync(filePath)) {
        try {
          await unlink(filePath)
        } catch (error) {
          console.error("Error deleting logo file:", error)
        }
      }

      await prisma.settings.update({
        where: { id: "app-settings" },
        data: {
          logoPath: null,
          updatedBy: session.user.id,
        },
      })
    }

    return NextResponse.json({ success: true, message: "Logo deleted" })
  } catch (error) {
    console.error("Error deleting logo:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

