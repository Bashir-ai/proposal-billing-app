import { prisma } from "./prisma"

/**
 * Generates a proposal number in the format YYYY-XXX
 * where YYYY is the current year and XXX is a zero-padded sequence number
 * 
 * Example: 2024-001, 2024-002, etc.
 */
export async function generateProposalNumber(): Promise<string> {
  const currentYear = new Date().getFullYear()
  const yearPrefix = currentYear.toString()
  
  // Find the last proposal number for the current year
  const lastProposal = await prisma.proposal.findFirst({
    where: {
      proposalNumber: {
        startsWith: yearPrefix + "-",
      },
    },
    orderBy: {
      proposalNumber: "desc",
    },
    select: {
      proposalNumber: true,
    },
  })
  
  let sequenceNumber = 1
  
  if (lastProposal?.proposalNumber) {
    // Extract the sequence number from the last proposal
    const parts = lastProposal.proposalNumber.split("-")
    if (parts.length === 2 && parts[0] === yearPrefix) {
      const lastSequence = parseInt(parts[1], 10)
      if (!isNaN(lastSequence)) {
        sequenceNumber = lastSequence + 1
      }
    }
  }
  
  // Format as YYYY-XXX with zero padding
  const paddedSequence = sequenceNumber.toString().padStart(3, "0")
  return `${yearPrefix}-${paddedSequence}`
}

/**
 * Validates a proposal number format
 */
export function isValidProposalNumberFormat(proposalNumber: string): boolean {
  const pattern = /^\d{4}-\d{3}$/
  return pattern.test(proposalNumber)
}

