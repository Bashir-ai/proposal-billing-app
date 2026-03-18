import { prisma } from "@/lib/prisma"

/**
 * Generates the next available client code.
 * Finds the highest clientCode in the database and returns the next number.
 * Starts at 1 if no clients exist.
 * 
 * @returns Promise<number> The next client code (1-999)
 */
export async function generateClientCode(): Promise<number> {
  const maxClient = await prisma.client.findFirst({
    where: {
      clientCode: { not: null },
    },
    orderBy: {
      clientCode: 'desc',
    },
    select: {
      clientCode: true,
    },
  })

  const nextCode = maxClient?.clientCode ? maxClient.clientCode + 1 : 1

  // Ensure we don't exceed 999 (3-digit limit)
  if (nextCode > 999) {
    throw new Error("Maximum client code (999) reached. Please contact administrator.")
  }

  return nextCode
}
