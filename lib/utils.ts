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

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

/**
 * Parse a date string (YYYY-MM-DD) in local timezone to prevent timezone conversion issues
 * This ensures dates are stored as the exact date selected, not shifted by timezone
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
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




