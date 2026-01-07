import { prisma } from "./prisma"

export interface UserStatistics {
  userId: string
  userName: string
  userEmail: string
  // Billed hours and services
  billedHours: number
  billedAmount: number
  // Clients
  clientsFound: number
  clientsManaged: number
  // Projects
  projectsManaged: number
  // Todos
  todosAssigned: number
  todosOngoing: number
  todosCompleted: number
  todosReassigned: number
  // Finder fees
  finderFeesEarned: number
  finderFeesPaid: number
  finderFeesPending: number
}

/**
 * Calculate comprehensive statistics for a user
 */
export async function calculateUserStatistics(
  userId: string,
  options?: {
    startDate?: Date
    endDate?: Date
  }
): Promise<UserStatistics> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
    },
  })

  if (!user) {
    throw new Error("User not found")
  }

  const dateFilter = options?.startDate || options?.endDate
    ? {
        ...(options.startDate && { gte: options.startDate }),
        ...(options.endDate && { lte: options.endDate }),
      }
    : undefined

  // Billed hours (from timesheet entries that are billed)
  const billedTimesheetEntries = await prisma.timesheetEntry.findMany({
    where: {
      userId,
      billed: true,
      ...(dateFilter && { date: dateFilter }),
    },
  })
  const billedHours = billedTimesheetEntries.reduce((sum, entry) => sum + entry.hours, 0)
  
  // Billed amount (from bill items where personId matches)
  const billedBillItems = await prisma.billItem.findMany({
    where: {
      personId: userId,
      bill: {
        status: "PAID",
        ...(dateFilter && { paidAt: dateFilter }),
      },
    },
    include: {
      bill: true,
    },
  })
  const billedAmount = billedBillItems.reduce((sum, item) => sum + item.amount, 0)

  // Clients found (as Client Finder)
  const clientsFound = await prisma.clientFinder.count({
    where: {
      userId,
      ...(dateFilter && { createdAt: dateFilter }),
    },
  })

  // Clients managed (as Client Manager)
  const clientsManaged = await prisma.client.count({
    where: {
      clientManagerId: userId,
      ...(dateFilter && { createdAt: dateFilter }),
    },
  })

  // Projects managed
  const projectsManaged = await prisma.projectManager.count({
    where: {
      userId,
      ...(dateFilter && { createdAt: dateFilter }),
    },
  })

  // Todos assigned
  const todosAssigned = await prisma.todo.count({
    where: {
      assignedTo: userId,
      ...(dateFilter && { createdAt: dateFilter }),
    },
  })

  // Todos ongoing (assigned, not completed, not cancelled)
  const todosOngoing = await prisma.todo.count({
    where: {
      assignedTo: userId,
      status: { in: ["PENDING", "IN_PROGRESS"] },
      ...(dateFilter && { createdAt: dateFilter }),
    },
  })

  // Todos completed
  const todosCompleted = await prisma.todo.count({
    where: {
      assignedTo: userId,
      status: "COMPLETED",
      ...(dateFilter && { completedAt: dateFilter }),
    },
  })

  // Todos reassigned
  const todosReassigned = await prisma.todoReassignment.count({
    where: {
      fromUserId: userId,
      ...(dateFilter && { createdAt: dateFilter }),
    },
  })

  // Finder fees
  const finderFeesWhere: any = {
    finderId: userId,
  }
  if (dateFilter) {
    finderFeesWhere.earnedAt = dateFilter
  }

  const finderFees = await prisma.finderFee.findMany({
    where: finderFeesWhere,
  })

  const finderFeesEarned = finderFees.reduce((sum, fee) => sum + fee.finderFeeAmount, 0)
  const finderFeesPaid = finderFees.reduce((sum, fee) => sum + fee.paidAmount, 0)
  const finderFeesPending = finderFees.reduce((sum, fee) => sum + fee.remainingAmount, 0)

  return {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    billedHours,
    billedAmount,
    clientsFound,
    clientsManaged,
    projectsManaged,
    todosAssigned,
    todosOngoing,
    todosCompleted,
    todosReassigned,
    finderFeesEarned,
    finderFeesPaid,
    finderFeesPending,
  }
}

/**
 * Calculate statistics for all users (admin view)
 */
export async function calculateAllUsersStatistics(
  options?: {
    startDate?: Date
    endDate?: Date
  }
): Promise<UserStatistics[]> {
  const users = await prisma.user.findMany({
    where: {
      role: { not: "CLIENT" },
    },
    select: {
      id: true,
    },
  })

  const statistics = await Promise.all(
    users.map((user) => calculateUserStatistics(user.id, options))
  )

  return statistics
}



