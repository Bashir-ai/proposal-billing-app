import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Lazy initialization - only create PrismaClient when actually used
// This prevents database connection attempts during module initialization/compilation
function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma
  }

  // Only create PrismaClient when actually needed (not during import)
  // Add connection timeout to prevent hanging
  const databaseUrl = process.env.DATABASE_URL
  const urlWithTimeout = databaseUrl?.includes('?') 
    ? `${databaseUrl}&connect_timeout=10`
    : databaseUrl?.includes('connect_timeout')
    ? databaseUrl
    : `${databaseUrl}?connect_timeout=10`

  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: urlWithTimeout,
      },
    },
  })

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client
  }

  return client
}

// Use a Proxy to intercept all property access and lazily initialize Prisma
// This ensures Prisma only connects when actually used, not during module import
const prismaProxy = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getPrismaClient()
    const value = (client as any)[prop]
    // Bind functions to maintain 'this' context
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
  set(_target, prop: string | symbol, value: any) {
    const client = getPrismaClient()
    ;(client as any)[prop] = value
    return true
  },
})

export const prisma = prismaProxy as PrismaClient








