import { prisma } from "../lib/prisma"

async function resetClientStats() {
  console.log("Resetting client statistics...")
  
  try {
    // Delete all ClientFinder records (resets clientsFound count)
    const deletedFinders = await prisma.clientFinder.deleteMany({})
    console.log(`✓ Deleted ${deletedFinders.count} ClientFinder records`)
    
    // Clear all clientManagerId fields (resets clientsManaged count)
    const updatedClients = await prisma.client.updateMany({
      data: {
        clientManagerId: null,
      },
    })
    console.log(`✓ Updated ${updatedClients.count} clients (cleared manager assignments)`)
    
    console.log("\n✅ Client statistics reset complete!")
    console.log("All users will now show:")
    console.log("  - clientsFound: 0")
    console.log("  - clientsManaged: 0")
  } catch (error) {
    console.error("Error resetting client statistics:", error)
    throw error
  }
}

resetClientStats()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
