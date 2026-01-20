require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") })
const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")

const prisma = new PrismaClient()

async function createDummyUsers() {
  const users = [
    {
      name: "MAT",
      email: "mat@test.com",
      password: "test123",
      role: "STAFF",
      defaultHourlyRate: 150,
    },
    {
      name: "SDF",
      email: "sdf@test.com",
      password: "test123",
      role: "STAFF",
      defaultHourlyRate: 175,
    },
    {
      name: "VHP",
      email: "vhp@test.com",
      password: "test123",
      role: "STAFF",
      defaultHourlyRate: 200,
    },
  ]

  console.log("Creating dummy users...\n")

  for (const userData of users) {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email },
      })

      if (existingUser) {
        console.log(`⚠️  User ${userData.name} (${userData.email}) already exists, skipping...`)
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

      console.log(`✓ Created user: ${user.name} (${user.email}) - Default rate: €${userData.defaultHourlyRate}/hr`)
    } catch (error) {
      console.error(`✗ Error creating user ${userData.name}:`, error.message)
    }
  }

  console.log("\n✓ Dummy users creation completed!")
}

createDummyUsers()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error("Error:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

