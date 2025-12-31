import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function createDummyUsers() {
  const users = [
    {
      name: "MAT",
      email: "mat@test.com",
      password: "test123",
      role: "STAFF" as const,
      defaultHourlyRate: 150,
    },
    {
      name: "SDF",
      email: "sdf@test.com",
      password: "test123",
      role: "STAFF" as const,
      defaultHourlyRate: 175,
    },
    {
      name: "VHP",
      email: "vhp@test.com",
      password: "test123",
      role: "STAFF" as const,
      defaultHourlyRate: 200,
    },
  ]

  for (const userData of users) {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email },
      })

      if (existingUser) {
        console.log(`User ${userData.name} (${userData.email}) already exists, skipping...`)
        continue
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10)

      // Create user
      const user = await prisma.user.create({
        data: {
          name: userData.name,
          email: userData.email,
          password: hashedPassword,
          role: userData.role,
          defaultHourlyRate: userData.defaultHourlyRate,
        },
      })

      console.log(`✓ Created user: ${user.name} (${user.email})`)
    } catch (error: any) {
      console.error(`✗ Error creating user ${userData.name}:`, error.message)
    }
  }
}

createDummyUsers()
  .then(() => {
    console.log("\n✓ Dummy users creation completed!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Error:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


