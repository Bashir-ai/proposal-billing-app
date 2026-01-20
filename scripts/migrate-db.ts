#!/usr/bin/env tsx
/**
 * Database migration script
 * Run this to push schema changes to the database
 * Usage: npx tsx scripts/migrate-db.ts
 */

import { execSync } from "child_process"
import { PrismaClient } from "@prisma/client"

async function migrate() {
  console.log("🔄 Starting database migration...")
  
  try {
    // First, generate Prisma Client
    console.log("📦 Generating Prisma Client...")
    execSync("npx prisma generate", { stdio: "inherit" })
    
    // Then, push schema to database
    console.log("🚀 Pushing schema to database...")
    execSync("npx prisma db push --accept-data-loss", { stdio: "inherit" })
    
    console.log("✅ Database migration completed successfully!")
    
    // Verify by checking if UserCompensation table exists
    const prisma = new PrismaClient()
    try {
      await prisma.$queryRaw`SELECT 1 FROM "UserCompensation" LIMIT 1`
      console.log("✅ Verified: UserCompensation table exists")
    } catch (error: any) {
      if (error.code === "P2021" || error.message?.includes("does not exist")) {
        console.error("❌ Error: UserCompensation table still does not exist")
        console.error("Please check your DATABASE_URL and database permissions")
        process.exit(1)
      }
    } finally {
      await prisma.$disconnect()
    }
  } catch (error) {
    console.error("❌ Migration failed:", error)
    process.exit(1)
  }
}

migrate()
