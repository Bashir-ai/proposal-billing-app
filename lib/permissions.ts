import { UserRole } from "@prisma/client"
import { prisma } from "./prisma"

interface User {
  id: string
  role: UserRole
  canApproveProposals?: boolean | null
  canApproveInvoices?: boolean | null
  canEditAllProposals?: boolean | null
  canEditAllInvoices?: boolean | null
  canViewAllClients?: boolean | null
  canCreateUsers?: boolean | null
}

export function canApproveProposals(user: User): boolean {
  // Check permission override first
  if (user.canApproveProposals === false) return false
  if (user.canApproveProposals === true) return true

  // Use role defaults
  return user.role === "ADMIN" || user.role === "MANAGER"
}

export function canApproveInvoices(user: User): boolean {
  // Check permission override first
  if (user.canApproveInvoices === false) return false
  if (user.canApproveInvoices === true) return true

  // Use role defaults
  return user.role === "ADMIN" || user.role === "MANAGER"
}

export function canEditAllProposals(user: User): boolean {
  // Check permission override first
  if (user.canEditAllProposals === false) return false
  if (user.canEditAllProposals === true) return true

  // Use role defaults
  return user.role === "ADMIN" || user.role === "MANAGER"
}

export function canEditAllInvoices(user: User): boolean {
  // Check permission override first
  if (user.canEditAllInvoices === false) return false
  if (user.canEditAllInvoices === true) return true

  // Use role defaults
  return user.role === "ADMIN" || user.role === "MANAGER"
}

export function canViewAllClients(user: User): boolean {
  // Check permission override first
  if (user.canViewAllClients === false) return false
  if (user.canViewAllClients === true) return true

  // Use role defaults
  return user.role === "ADMIN" || user.role === "MANAGER" || user.role === "STAFF"
}

export function canCreateUsers(user: User): boolean {
  // Only admins can create users by default
  // Permission override can grant this to others
  if (user.canCreateUsers === true) return true
  return user.role === "ADMIN"
}

export function canEditProposal(
  user: User,
  proposal: { createdBy: string; status: string }
): boolean {
  // Admin can always edit
  if (user.role === "ADMIN") return true

  // Check if user can edit all proposals
  if (canEditAllProposals(user)) return true

  // Creator can edit their own proposals if status is DRAFT or SUBMITTED
  if (proposal.createdBy === user.id) {
    return proposal.status === "DRAFT" || proposal.status === "SUBMITTED"
  }

  return false
}

export function canEditInvoice(
  user: User,
  invoice: { createdBy: string; status: string }
): boolean {
  // Admin can always edit
  if (user.role === "ADMIN") return true

  // Check if user can edit all invoices
  if (canEditAllInvoices(user)) return true

  // Creator can edit their own invoices if status is DRAFT or SUBMITTED
  if (invoice.createdBy === user.id) {
    return invoice.status === "DRAFT" || invoice.status === "SUBMITTED"
  }

  return false
}

export function canDeleteItems(user: User): boolean {
  // Only admins can delete items
  return user.role === "ADMIN"
}

/**
 * Get role hierarchy value for comparison
 * Higher number = higher rank
 */
function getRoleRank(role: UserRole): number {
  switch (role) {
    case "ADMIN":
      return 4
    case "MANAGER":
      return 3
    case "STAFF":
      return 2
    case "CLIENT":
      return 1
    case "EXTERNAL":
      return 0.5
    default:
      return 0
  }
}

/**
 * Check if user1 has higher rank than user2
 * Role hierarchy: ADMIN > MANAGER > STAFF > CLIENT
 */
export function hasHigherRank(user1: User, user2: User): boolean {
  return getRoleRank(user1.role) > getRoleRank(user2.role)
}

/**
 * Check if current user can reassign a todo
 * Reassignment is allowed if:
 * - Current user is the assignee AND creator has higher rank than assignee
 * - Current user is the creator
 * - Current user is an admin
 */
export function canReassignTodo(
  creator: User,
  assignee: User,
  currentUser: User
): boolean {
  // Admin can always reassign
  if (currentUser.role === "ADMIN") return true

  // Creator can always reassign
  if (creator.id === currentUser.id) return true

  // Assignee can reassign if creator has higher rank
  if (assignee.id === currentUser.id) {
    return hasHigherRank(creator, assignee)
  }

  return false
}

/**
 * Check if External user can bill hours in a project
 * External users can only bill hours in projects they're assigned to
 */
export async function canBillHours(user: User, projectId: string): Promise<boolean> {
  // Non-External users can always bill hours (subject to other permissions)
  if (user.role !== "EXTERNAL") return true

  // Check if user is assigned to the project
  const projectManager = await prisma.projectManager.findFirst({
    where: {
      projectId,
      userId: user.id,
    },
  })

  return !!projectManager
}

/**
 * Check if External user can view an invoice
 * External users can view invoices for clients where they are:
 * - Client manager, OR
 * - Finder
 */
export async function canViewInvoice(user: User, invoice: { clientId: string }): Promise<boolean> {
  // Non-External users can view invoices (subject to other permissions)
  if (user.role !== "EXTERNAL") return true

  // Check if user is client manager or finder
  const client = await prisma.client.findUnique({
    where: { id: invoice.clientId },
    include: {
      finders: true,
    },
  })

  if (!client) return false

  // Check if user is client manager
  if (client.clientManagerId === user.id) return true

  // Check if user is a finder
  const isFinder = client.finders.some((finder) => finder.userId === user.id)
  if (isFinder) return true

  return false
}

/**
 * Check if user can view an account
 * External users can only view their own account
 */
export function canViewAccount(user: User, accountUserId: string): boolean {
  // Non-External users can view accounts (subject to other permissions)
  if (user.role !== "EXTERNAL") return true

  // External users can only view their own account
  return user.id === accountUserId
}

