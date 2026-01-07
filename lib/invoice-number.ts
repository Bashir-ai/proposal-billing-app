import { prisma } from "./prisma"

/**
 * Generate the next invoice number in the format INV-YYYY-XXX
 * where YYYY is the current year and XXX is a 3-digit sequence number
 */
export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`

  // Find the highest invoice number for this year
  const latestInvoice = await prisma.bill.findFirst({
    where: {
      invoiceNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      invoiceNumber: "desc",
    },
    select: {
      invoiceNumber: true,
    },
  })

  let nextNumber = 1

  if (latestInvoice?.invoiceNumber) {
    // Extract the number part after the prefix
    const numberPart = latestInvoice.invoiceNumber.replace(prefix, "")
    const parsedNumber = parseInt(numberPart, 10)
    if (!isNaN(parsedNumber)) {
      nextNumber = parsedNumber + 1
    }
  }

  // Format with leading zeros (3 digits)
  const formattedNumber = nextNumber.toString().padStart(3, "0")
  return `${prefix}${formattedNumber}`
}



