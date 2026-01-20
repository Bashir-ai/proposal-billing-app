import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: any | undefined
}

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma
  }

  let client: PrismaClient

  // Use Neon adapter for serverless environments (Vercel)
  const connectionString = process.env.DATABASE_URL
  const isVercel = process.env.VERCEL_ENV || connectionString?.includes('neon.tech')

  if (isVercel && connectionString) {
    try {
      // Dynamically import Neon adapter (only in serverless)
      // Check if adapter is available (may not be installed yet)
      let PrismaNeon: any
      try {
        PrismaNeon = require('@prisma/adapter-neon').PrismaNeon
      } catch {
        // Adapter not installed, fall through to standard Prisma
        throw new Error('Prisma adapter not installed')
      }

      const { Pool, neonConfig } = require('@neondatabase/serverless')
      
      // Configure WebSocket for Neon (only if ws is available)
      try {
        const ws = require('ws')
        neonConfig.webSocketConstructor = ws
      } catch {
        // ws not available, will use default
      }

      if (!globalForPrisma.pool) {
        globalForPrisma.pool = new Pool({ connectionString })
      }
      
      const adapter = new PrismaNeon(globalForPrisma.pool)
      client = new PrismaClient({ 
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      } as any)
    } catch (error) {
      // Fallback to standard Prisma if adapter fails or isn't installed
      if (process.env.NODE_ENV === 'development') {
        console.warn('Neon adapter not available, using standard Prisma. Install @prisma/adapter-neon and ws for better performance on Vercel.')
      }
      client = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      })
    }
  } else {
    // Standard Prisma for local development
    client = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
  }

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client
  }

  return client
}

// Use a Proxy to intercept all property access and lazily initialize Prisma
const prismaProxy = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getPrismaClient()
    const value = (client as any)[prop]
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
