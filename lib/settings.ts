import { cache } from "react"
import { prisma } from "@/lib/prisma"

export interface Settings {
  id: string
  logoPath: string | null
  updatedAt: Date
  updatedBy: string | null
}

/**
 * Get current application settings (cached)
 */
export const getSettings = cache(async (): Promise<Settings | null> => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: "app-settings" },
      select: {
        id: true,
        logoPath: true,
        updatedAt: true,
        updatedBy: true,
      },
    })
    return settings
  } catch (error) {
    console.error("Error fetching settings:", error)
    return null
  }
})

/**
 * Get logo path from settings (cached)
 */
export const getLogoPath = cache(async (): Promise<string | null> => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: "app-settings" },
      select: { logoPath: true }
    })
    return settings?.logoPath || null
  } catch (error) {
    console.error("Error fetching logo:", error)
    return null
  }
})

/**
 * Update logo path in settings
 */
export async function updateLogoPath(
  logoPath: string | null,
  updatedBy: string
): Promise<Settings> {
  const settings = await prisma.settings.upsert({
    where: { id: "app-settings" },
    update: {
      logoPath,
      updatedBy,
    },
    create: {
      id: "app-settings",
      logoPath,
      updatedBy,
    },
  })
  return settings
}




