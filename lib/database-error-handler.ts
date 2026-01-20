/**
 * Helper functions to detect and handle database connection errors
 */

export function isDatabaseConnectionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const prismaError = error as { name?: string; message?: string }

  // Check for Prisma client initialization errors
  if (prismaError.name === 'PrismaClientInitializationError') {
    return true
  }

  // Check for database connection error messages
  if (prismaError.message) {
    const message = prismaError.message.toLowerCase()
    return (
      message.includes("can't reach database server") ||
      message.includes("database server") ||
      message.includes("connection refused") ||
      message.includes("connection timeout") ||
      message.includes("connect econnrefused")
    )
  }

  return false
}

export function getDatabaseErrorMessage(): string {
  return "Unable to connect to the database. Please check your database connection and try again."
}
