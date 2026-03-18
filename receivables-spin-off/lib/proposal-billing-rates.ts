import { UserProfile } from "@prisma/client"

// Profile label mapping for display
export const PROFILE_LABELS: Record<UserProfile, string> = {
  SECRETARIAT: "Secretariat",
  TRAINEE: "Trainee",
  JUNIOR_LAWYER: "Junior Lawyer",
  LAWYER: "Lawyer",
  SENIOR_LAWYER: "Senior Lawyer",
  PARTNER: "Partner",
}

/**
 * Determines the billing rate for a user based on proposal configuration
 * Priority order:
 * 1. Blended Rate (if useBlendedRate is true and blendedRate exists)
 * 2. Hourly Table Rate (if hourlyRateTableType is HOURLY_TABLE and rate exists for user's profile)
 * 3. Rate Range average (if hourlyRateTableType is RATE_RANGE)
 * 4. User Default Rate (fallback)
 */
export function getBillingRateForUser(
  proposal: {
    type: string
    useBlendedRate?: boolean | null
    blendedRate?: number | null
    hourlyRateTableType?: string | null
    hourlyRateTableRates?: any // JSON object
    hourlyRateRangeMin?: number | null
    hourlyRateRangeMax?: number | null
  },
  user: {
    profile: UserProfile | null
    defaultHourlyRate: number | null
  }
): number | null {
  // Only apply proposal rates for HOURLY proposals
  if (proposal.type !== "HOURLY") {
    return user.defaultHourlyRate
  }

  // Priority 1: Blended Rate
  if (proposal.useBlendedRate && proposal.blendedRate && proposal.blendedRate > 0) {
    return proposal.blendedRate
  }

  // Priority 2: Hourly Table Rate
  if (
    proposal.hourlyRateTableType === "HOURLY_TABLE" &&
    proposal.hourlyRateTableRates &&
    user.profile
  ) {
    const rates = typeof proposal.hourlyRateTableRates === 'string' 
      ? JSON.parse(proposal.hourlyRateTableRates)
      : proposal.hourlyRateTableRates
    
    const profileRate = rates[user.profile]
    if (profileRate && profileRate > 0) {
      return profileRate
    }
  }

  // Priority 3: Rate Range average
  if (
    proposal.hourlyRateTableType === "RATE_RANGE" &&
    proposal.hourlyRateRangeMin &&
    proposal.hourlyRateRangeMax
  ) {
    const averageRate = (proposal.hourlyRateRangeMin + proposal.hourlyRateRangeMax) / 2
    if (averageRate > 0) {
      return averageRate
    }
  }

  // Priority 4: User Default Rate
  return user.defaultHourlyRate
}

/**
 * Determines the billing rate for a user in a project
 * Priority order:
 * 1. Project-specific user rate (from ProjectUserRate)
 * 2. Project blended rate (if useBlendedRate is true)
 * 3. Project hourly table rate (by profile)
 * 4. Project rate range average
 * 5. Fall back to proposal rates (getBillingRateForUser)
 * 6. User default rate
 */
export function getBillingRateForUserInProject(
  project: {
    useBlendedRate?: boolean | null
    blendedRate?: number | null
    hourlyRateTableType?: string | null
    hourlyRateTableRates?: any // JSON object
    hourlyRateRangeMin?: number | null
    hourlyRateRangeMax?: number | null
    userRates?: Array<{ userId: string; rate: number }> | null
  },
  proposal: {
    type: string
    useBlendedRate?: boolean | null
    blendedRate?: number | null
    hourlyRateTableType?: string | null
    hourlyRateTableRates?: any
    hourlyRateRangeMin?: number | null
    hourlyRateRangeMax?: number | null
  } | null,
  user: {
    id: string
    profile: UserProfile | null
    defaultHourlyRate: number | null
  }
): number | null {
  // Priority 1: Project-specific user rate
  if (project.userRates && project.userRates.length > 0) {
    const userRate = project.userRates.find(ur => ur.userId === user.id)
    if (userRate && userRate.rate > 0) {
      return userRate.rate
    }
  }

  // Priority 2: Project blended rate
  if (project.useBlendedRate && project.blendedRate && project.blendedRate > 0) {
    return project.blendedRate
  }

  // Priority 3: Project hourly table rate
  if (
    project.hourlyRateTableType === "HOURLY_TABLE" &&
    project.hourlyRateTableRates &&
    user.profile
  ) {
    const rates = typeof project.hourlyRateTableRates === 'string'
      ? JSON.parse(project.hourlyRateTableRates)
      : project.hourlyRateTableRates
    
    const profileRate = rates[user.profile]
    if (profileRate && profileRate > 0) {
      return profileRate
    }
  }

  // Priority 4: Project rate range average
  if (
    project.hourlyRateTableType === "RATE_RANGE" &&
    project.hourlyRateRangeMin &&
    project.hourlyRateRangeMax
  ) {
    const averageRate = (project.hourlyRateRangeMin + project.hourlyRateRangeMax) / 2
    if (averageRate > 0) {
      return averageRate
    }
  }

  // Priority 5: Fall back to proposal rates
  if (proposal) {
    const proposalRate = getBillingRateForUser(proposal, user)
    if (proposalRate !== null) {
      return proposalRate
    }
  }

  // Priority 6: User default rate
  return user.defaultHourlyRate
}
