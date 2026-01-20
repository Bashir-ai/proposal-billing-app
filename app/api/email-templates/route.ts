export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const emailTemplateSchema = z.object({
  type: z.enum(["PROPOSAL", "INVOICE", "OTHER"]),
  name: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  isDefault: z.boolean().optional().default(false),
})

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")

    const where: any = {}
    if (type) {
      where.type = type
    }

    const templates = await prisma.emailTemplate.findMany({
      where,
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
      include: {
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(templates)
  } catch (error: any) {
    console.error("Error fetching email templates:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
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

    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = emailTemplateSchema.parse(body)

    // If this is set as default, unset other defaults for the same type
    if (validatedData.isDefault) {
      await prisma.emailTemplate.updateMany({
        where: {
          type: validatedData.type,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      })
    }

    const template = await prisma.emailTemplate.create({
      data: {
        ...validatedData,
        createdBy: session.user.id,
      },
      include: {
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error creating email template:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}
