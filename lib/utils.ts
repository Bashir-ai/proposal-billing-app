import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount)
}

/**
 * Get user's timezone, with fallback to UTC
 * @param userTimezone - Optional timezone string from user settings
 * @returns IANA timezone string (defaults to "UTC")
 */
export function getUserTimezone(userTimezone?: string | null): string {
  return userTimezone || "UTC"
}

/**
 * Format a date in the user's timezone
 * @param date - Date object or string
 * @param userTimezone - Optional user timezone (defaults to UTC)
 * @returns Formatted date string
 */
export function formatDate(date: Date | string, userTimezone?: string | null): string {
  const tz = getUserTimezone(userTimezone)
  const dateObj = new Date(date)
  
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: tz,
    }).format(dateObj)
  } catch (error) {
    // Fallback to default formatting if timezone is invalid
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(dateObj)
  }
}

/**
 * Format a date for date input (YYYY-MM-DD) in the user's timezone
 * @param date - Date object, string, or null
 * @param userTimezone - Optional user timezone (defaults to UTC)
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateForInput(date: Date | string | null, userTimezone?: string | null): string {
  if (!date) {
    // Get today's date in the user's timezone
    const tz = getUserTimezone(userTimezone)
    const now = new Date()
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      return formatter.format(now)
    } catch (error) {
      // Fallback to local timezone
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  }
  
  if (date instanceof Date) {
    const tz = getUserTimezone(userTimezone)
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      return formatter.format(date)
    } catch (error) {
      // Fallback to local date components
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  }
  
  if (typeof date === 'string') {
    // If it's already YYYY-MM-DD, use it directly
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date
    }
    // Try to parse and format
    const dateObj = new Date(date)
    const tz = getUserTimezone(userTimezone)
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      return formatter.format(dateObj)
    } catch (error) {
      // Fallback
      const year = dateObj.getFullYear()
      const month = String(dateObj.getMonth() + 1).padStart(2, '0')
      const day = String(dateObj.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  }
  
  return new Date().toISOString().split('T')[0]
}

/**
 * Parse a date string (YYYY-MM-DD) in the user's timezone to prevent timezone conversion issues
 * This ensures dates are stored as the exact date selected, not shifted by timezone
 * @param dateString - Date string in YYYY-MM-DD format
 * @param userTimezone - Optional user timezone (defaults to UTC)
 * @returns Date object representing midnight in the user's timezone
 */
export function parseLocalDate(dateString: string, userTimezone?: string | null): Date {
  const tz = getUserTimezone(userTimezone)
  const [year, month, day] = dateString.split('-').map(Number)
  
  // Create date string in ISO format
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  
  if (tz === "UTC") {
    // Simple case: UTC
    return new Date(Date.UTC(year, month - 1, day))
  }
  
  try {
    // Create a date object representing midnight in the user's timezone
    // We use Intl.DateTimeFormat to get the offset
    const tempDate = new Date(`${dateStr}T00:00:00`)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    
    const parts = formatter.formatToParts(tempDate)
    const tzYear = parseInt(parts.find(p => p.type === 'year')?.value || String(year))
    const tzMonth = parseInt(parts.find(p => p.type === 'month')?.value || String(month))
    const tzDay = parseInt(parts.find(p => p.type === 'day')?.value || String(day))
    
    // Create date in UTC that represents midnight in the user's timezone
    // We need to get the UTC offset for that timezone at that date
    const localDateStr = `${String(tzYear).padStart(4, '0')}-${String(tzMonth).padStart(2, '0')}-${String(tzDay).padStart(2, '0')}T00:00:00`
    const testDate = new Date(localDateStr)
    
    // Get what UTC time corresponds to midnight in the user's timezone
    // We'll create a date and adjust based on timezone offset
    const utcDate = new Date(testDate.toLocaleString('en-US', { timeZone: 'UTC' }))
    const tzDate = new Date(testDate.toLocaleString('en-US', { timeZone: tz }))
    const offset = utcDate.getTime() - tzDate.getTime()
    
    // Create UTC date that represents midnight in the user's timezone
    return new Date(Date.UTC(year, month - 1, day) - offset)
  } catch (error) {
    // Fallback to simple parsing
    return new Date(year, month - 1, day)
  }
}

/**
 * Parse hours input that can be in decimal format (1.5 or 1,5) or hours:minutes format (1:30)
 * Examples:
 * - "1:30" -> 1.5
 * - "2:15" -> 2.25
 * - "1.5" -> 1.5
 * - "1,5" -> 1.5 (European decimal format)
 * - "2" -> 2
 * @param input - String input that can be decimal or H:MM format
 * @returns Number of hours as decimal
 */
export function parseHoursInput(input: string): number {
  if (!input || input.trim() === "") {
    return 0
  }

  const trimmed = input.trim()

  // Check if input contains colon (hours:minutes format)
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":")
    if (parts.length === 2) {
      const hours = parseFloat(parts[0]) || 0
      const minutes = parseFloat(parts[1]) || 0
      
      // Validate minutes are between 0-59
      if (minutes < 0 || minutes >= 60) {
        throw new Error("Minutes must be between 0 and 59")
      }
      
      // Convert minutes to decimal (e.g., 30 minutes = 0.5 hours)
      return hours + (minutes / 60)
    }
  }

  // Handle decimal format - support both period (1.5) and comma (1,5) as decimal separators
  // Replace comma with period for parsing
  const normalizedInput = trimmed.replace(',', '.')
  const decimal = parseFloat(normalizedInput)
  if (isNaN(decimal)) {
    throw new Error("Invalid hours format. Use decimal (1.5 or 1,5) or hours:minutes (1:30)")
  }

  return decimal
}




