import { prisma } from "@/lib/prisma"

export interface Settings {
  id: string
  logoPath: string | null
  updatedAt: Date
  updatedBy: string | null
}

/**
 * Get current application settings
 */
export async function getSettings(): Promise<Settings | null> {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: "app-settings" },
    })
    return settings
  } catch (error) {
    console.error("Error fetching settings:", error)
    return null
  }
}

/**
 * Get logo path from settings
 */
export async function getLogoPath(): Promise<string | null> {
  const settings = await getSettings()
  return settings?.logoPath || null
}

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



