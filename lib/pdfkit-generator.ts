import PDFDocument from 'pdfkit'
import { prisma } from "@/lib/prisma"

type PDFDoc = InstanceType<typeof PDFDocument>

// Page dimensions (A4)
const PAGE_WIDTH = 595.28 // A4 width in points
const PAGE_HEIGHT = 841.89 // A4 height in points
const MARGIN = 50
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2)

// Helper function to get currency symbol
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    CAD: "C$",
    AUD: "A$",
  }
  return symbols[currency] || currency
}

// Helper function to format currency
function formatCurrency(amount: number, currency: string): string {
  const symbol = getCurrencySymbol(currency)
  return `${symbol}${amount.toFixed(2)}`
}

// Helper function to format date
function formatDate(date: Date | string | null): string {
  if (!date) return ""
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

// Helper function to format date in Portuguese format
function formatDatePortuguese(date: Date | string | null): string {
  if (!date) return ""
  const d = new Date(date)
  const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", 
                  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
  return `${d.getDate()} de ${months[d.getMonth()]} ${d.getFullYear()}`
}

// Helper function to get currency name
function getCurrencyName(currency: string): string {
  const names: Record<string, string> = {
    USD: "US Dollar",
    EUR: "Euro",
    GBP: "British Pound",
    CAD: "Canadian Dollar",
    AUD: "Australian Dollar",
  }
  return names[currency] || currency
}


// Helper function to add logo
function addLogo(doc: PDFDoc, logoBase64: string | null, y: number): number {
  if (!logoBase64) return y

  try {
    // Extract base64 data
    const base64Data = logoBase64.replace(/^data:image\/\w+;base64,/, "")
    const logoBuffer = Buffer.from(base64Data, 'base64')
    
    // Determine image format from mime type
    const mimeMatch = logoBase64.match(/^data:image\/(\w+);base64,/)
    const format = mimeMatch ? mimeMatch[1] : 'png'
    
    // Add image (pdfkit supports png, jpeg, jpg)
    if (format === 'png' || format === 'jpeg' || format === 'jpg') {
      doc.image(logoBuffer, MARGIN, y, { 
        fit: [200, 80],
        align: 'left'
      })
      return y + 90
    }
  } catch (error) {
    console.error("Error adding logo to PDF:", error)
  }
  
  return y
}

// Helper function to draw a table row
function drawTableRow(
  doc: PDFDoc,
  y: number,
  columns: Array<{ text: string; width: number; align?: 'left' | 'right' | 'center' }>,
  isHeader: boolean = false
): number {
  const rowHeight = 25
  let x = MARGIN
  
  columns.forEach((col, index) => {
    // Draw cell background for header
    if (isHeader) {
      doc.rect(x, y, col.width, rowHeight)
        .fillColor('#f3f4f6')
        .fill()
    }
    
    // Draw border
    doc.rect(x, y, col.width, rowHeight)
      .strokeColor('#e5e7eb')
      .lineWidth(0.5)
      .stroke()
    
    // Add text
    doc.fontSize(isHeader ? 10 : 9)
      .fillColor(isHeader ? '#374151' : '#111827')
      .text(col.text, x + 5, y + (rowHeight / 2) - 5, {
        width: col.width - 10,
        align: col.align || 'left',
        height: rowHeight,
        valign: 'center'
      })
    
    x += col.width
  })
  
  return y + rowHeight
}

// Helper function to wrap text
function wrapText(text: string, maxWidth: number, doc: PDFDoc): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''
  
  words.forEach(word => {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const width = doc.widthOfString(testLine, { width: maxWidth })
    
    if (width <= maxWidth) {
      currentLine = testLine
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    }
  })
  
  if (currentLine) lines.push(currentLine)
  return lines
}

// Helper function to check if we need a new page
function checkPageBreak(doc: PDFDoc, requiredHeight: number): void {
  const currentY = doc.y
  const pageHeight = PAGE_HEIGHT - MARGIN
  
  if (currentY + requiredHeight > pageHeight) {
    doc.addPage()
  }
}

// Get logo base64 from database
export async function getLogoBase64(): Promise<string | null> {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: "app-settings" },
      select: {
        logoData: true,
        logoMimeType: true,
      },
    })

    if (!settings?.logoData || !settings?.logoMimeType) {
      return null
    }

    return `data:${settings.logoMimeType};base64,${settings.logoData}`
  } catch (error: any) {
    console.error("Error loading logo:", error)
    return null
  }
}

// Generate Proposal PDF
export async function generateProposalPdf(proposal: any, logoBase64: string | null): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN }
      })
      
      const buffers: Buffer[] = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)
      
      let y = MARGIN
      const currencySymbol = getCurrencySymbol(proposal.currency)
      const recipient = proposal.client || proposal.lead
      
      // Add logo
      y = addLogo(doc, logoBase64, y)
      doc.moveDown(0.5)
      
      // Header
      doc.fontSize(24)
        .fillColor('#111827')
        .text(proposal.title, MARGIN, y)
      
      y = doc.y + 10
      
      if (proposal.proposalNumber) {
        doc.fontSize(14)
          .fillColor('#6b7280')
          .text(`Proposal #${proposal.proposalNumber}`, MARGIN, y)
        y = doc.y + 20
      }
      
      // Draw header border
      doc.moveTo(MARGIN, y)
        .lineTo(PAGE_WIDTH - MARGIN, y)
        .strokeColor('#2563eb')
        .lineWidth(2)
        .stroke()
      
      y += 20
      
      // Details section
      doc.fontSize(10)
        .fillColor('#374151')
      
      if (recipient) {
        doc.text(`${proposal.client ? "Client" : "Lead"}:`, MARGIN, y)
          .fillColor('#111827')
          .text(`${recipient.name}${recipient.company ? ` (${recipient.company})` : ""}`, MARGIN + 80, y)
        y = doc.y + 8
      }
      
      doc.fillColor('#374151')
        .text("Created by:", MARGIN, y)
        .fillColor('#111827')
        .text(proposal.creator.name, MARGIN + 80, y)
      y = doc.y + 8
      
      if (proposal.issueDate) {
        doc.fillColor('#374151')
          .text("Issue Date:", MARGIN, y)
          .fillColor('#111827')
          .text(formatDate(proposal.issueDate), MARGIN + 80, y)
        y = doc.y + 8
      }
      
      if (proposal.expiryDate) {
        doc.fillColor('#374151')
          .text("Expiry Date:", MARGIN, y)
          .fillColor('#111827')
          .text(formatDate(proposal.expiryDate), MARGIN + 80, y)
        y = doc.y + 20
      }
      
      // Description
      if (proposal.description) {
        checkPageBreak(doc, 50)
        doc.fontSize(12)
          .fillColor('#374151')
          .text("Description", MARGIN, doc.y)
        
        y = doc.y + 10
        
        const descLines = wrapText(proposal.description, CONTENT_WIDTH, doc)
        doc.fontSize(10)
          .fillColor('#111827')
        
        descLines.forEach(line => {
          checkPageBreak(doc, 15)
          doc.text(line, MARGIN, doc.y)
          y = doc.y + 5
        })
        
        y = doc.y + 15
      }
      
      // Hourly Rate Chart (for HOURLY proposals with HOURLY_TABLE)
      if (
        proposal.type === "HOURLY" &&
        proposal.hourlyRateTableType === "HOURLY_TABLE" &&
        proposal.hourlyRateTableRates
      ) {
        checkPageBreak(doc, 150)
        doc.fontSize(14)
          .fillColor('#111827')
          .text("Hourly Rates by Profile", MARGIN, doc.y + 10)
        
        y = doc.y + 15
        
        const rates = typeof proposal.hourlyRateTableRates === 'string' 
          ? JSON.parse(proposal.hourlyRateTableRates)
          : proposal.hourlyRateTableRates
        
        const profileOrder = ["PARTNER", "SENIOR_LAWYER", "LAWYER", "JUNIOR_LAWYER", "TRAINEE", "SECRETARIAT"]
        const profileLabels: Record<string, string> = {
          SECRETARIAT: "Secretariat",
          TRAINEE: "Trainee",
          JUNIOR_LAWYER: "Junior Lawyer",
          LAWYER: "Lawyer",
          SENIOR_LAWYER: "Senior Lawyer",
          PARTNER: "Partner",
        }
        
        const colWidths = {
          profile: CONTENT_WIDTH * 0.6,
          rate: CONTENT_WIDTH * 0.4,
        }
        
        // Table header
        y = drawTableRow(doc, y, [
          { text: "Profile", width: colWidths.profile },
          { text: "Rate", width: colWidths.rate, align: 'right' },
        ], true)
        
        // Table rows
        profileOrder
          .filter(profile => rates[profile] && rates[profile] > 0)
          .forEach((profile) => {
            checkPageBreak(doc, 30)
            y = drawTableRow(doc, y, [
              { text: profileLabels[profile] || profile, width: colWidths.profile },
              { text: `${currencySymbol}${rates[profile].toFixed(2)}/hr`, width: colWidths.rate, align: 'right' },
            ])
          })
        
        y += 10
      }

      // Estimate warning
      const hasEstimated = proposal.items?.some((item: any) => item.isEstimate === true || item.isEstimated === true)
      const hasHourlyEstimate = proposal.type === "HOURLY" && proposal.hourlyIsEstimate === true
      if (hasEstimated || hasHourlyEstimate) {
        checkPageBreak(doc, 60)
        doc.rect(MARGIN, doc.y, CONTENT_WIDTH, hasHourlyEstimate ? 70 : 50)
          .fillColor('#fef3c7')
          .fill()
          .strokeColor('#fbbf24')
          .lineWidth(2)
          .stroke()
          .fillColor('#92400e')
          .fontSize(12)
          .text("⚠️ Proposed fees are estimated", MARGIN + 10, doc.y + 10)
        
        if (hasHourlyEstimate) {
          doc.fontSize(10)
            .fillColor('#92400e')
            .text("An average fee was used for the purposes of estimating fees at hourly rates.", MARGIN + 10, doc.y + 25)
        }
        
        y = doc.y + (hasHourlyEstimate ? 30 : 20)
      }
      
      // Items tables
      const servicesItems = proposal.items?.filter((item: any) => !item.expenseId) || []
      const expensesItems = proposal.items?.filter((item: any) => item.expenseId !== null) || []
      
      // Services table
      if (servicesItems.length > 0) {
        checkPageBreak(doc, 100)
        doc.fontSize(14)
          .fillColor('#111827')
          .text("Services", MARGIN, doc.y + 10)
        
        y = doc.y + 15
        
        const colWidths = {
          desc: CONTENT_WIDTH * 0.4,
          qty: CONTENT_WIDTH * 0.15,
          price: CONTENT_WIDTH * 0.15,
          discount: CONTENT_WIDTH * 0.15,
          amount: CONTENT_WIDTH * 0.15,
        }
        
        // Table header
        y = drawTableRow(doc, y, [
          { text: "Description", width: colWidths.desc },
          { text: "Quantity", width: colWidths.qty, align: 'right' },
          { text: "Unit Price", width: colWidths.price, align: 'right' },
          { text: "Discount", width: colWidths.discount, align: 'right' },
          { text: "Amount", width: colWidths.amount, align: 'right' },
        ], true)
        
        // Table rows
        servicesItems.forEach((item: any) => {
          checkPageBreak(doc, 30)
          
          const unitPriceDisplay = item.rate 
            ? `${currencySymbol}${item.rate.toFixed(2)}/hr` 
            : item.unitPrice 
              ? `${currencySymbol}${item.unitPrice.toFixed(2)}` 
              : "-"
          
          const discountDisplay = item.discountPercent 
            ? `${item.discountPercent}%` 
            : item.discountAmount 
              ? `${currencySymbol}${item.discountAmount.toFixed(2)}` 
              : "-"
          
          y = drawTableRow(doc, y, [
            { text: item.description || "-", width: colWidths.desc },
            { text: item.quantity?.toString() || "-", width: colWidths.qty, align: 'right' },
            { text: unitPriceDisplay, width: colWidths.price, align: 'right' },
            { text: discountDisplay, width: colWidths.discount, align: 'right' },
            { text: formatCurrency(item.amount, proposal.currency), width: colWidths.amount, align: 'right' },
          ])
        })
        
        y += 10
      }
      
      // Expenses table
      if (expensesItems.length > 0) {
        checkPageBreak(doc, 100)
        doc.fontSize(14)
          .fillColor('#111827')
          .text("Expenses", MARGIN, doc.y + 10)
        
        y = doc.y + 15
        
        const colWidths = {
          desc: CONTENT_WIDTH * 0.4,
          qty: CONTENT_WIDTH * 0.15,
          price: CONTENT_WIDTH * 0.15,
          discount: CONTENT_WIDTH * 0.15,
          amount: CONTENT_WIDTH * 0.15,
        }
        
        // Table header
        y = drawTableRow(doc, y, [
          { text: "Description", width: colWidths.desc },
          { text: "Quantity", width: colWidths.qty, align: 'right' },
          { text: "Unit Price", width: colWidths.price, align: 'right' },
          { text: "Discount", width: colWidths.discount, align: 'right' },
          { text: "Amount", width: colWidths.amount, align: 'right' },
        ], true)
        
        // Table rows
        expensesItems.forEach((item: any) => {
          checkPageBreak(doc, 30)
          
          const unitPriceDisplay = item.rate 
            ? `${currencySymbol}${item.rate.toFixed(2)}/hr` 
            : item.unitPrice 
              ? `${currencySymbol}${item.unitPrice.toFixed(2)}` 
              : "-"
          
          const discountDisplay = item.discountPercent 
            ? `${item.discountPercent}%` 
            : item.discountAmount 
              ? `${currencySymbol}${item.discountAmount.toFixed(2)}` 
              : "-"
          
          y = drawTableRow(doc, y, [
            { text: `[Expense] ${item.description || "-"}`, width: colWidths.desc },
            { text: item.quantity?.toString() || "-", width: colWidths.qty, align: 'right' },
            { text: unitPriceDisplay, width: colWidths.price, align: 'right' },
            { text: discountDisplay, width: colWidths.discount, align: 'right' },
            { text: formatCurrency(item.amount, proposal.currency), width: colWidths.amount, align: 'right' },
          ])
        })
        
        y += 10
      }
      
      // Totals
      if (proposal.items && proposal.items.length > 0) {
        checkPageBreak(doc, 150)
        
        const servicesSubtotal = servicesItems.reduce((sum: number, item: any) => sum + item.amount, 0)
        const expensesSubtotal = expensesItems.reduce((sum: number, item: any) => sum + item.amount, 0)
        const subtotal = servicesSubtotal + expensesSubtotal
        
        const clientDiscount = proposal.clientDiscountPercent 
          ? servicesSubtotal * (proposal.clientDiscountPercent / 100)
          : proposal.clientDiscountAmount || 0
        
        const servicesAfterDiscount = servicesSubtotal - clientDiscount
        const tax = proposal.taxRate && proposal.taxRate > 0
          ? (proposal.taxInclusive 
              ? servicesAfterDiscount * (proposal.taxRate / (100 + proposal.taxRate))
              : servicesAfterDiscount * (proposal.taxRate / 100))
          : 0
        
        const grandTotal = proposal.taxInclusive 
          ? servicesAfterDiscount + expensesSubtotal 
          : servicesAfterDiscount + tax + expensesSubtotal
        
        const totalsY = doc.y + 10
        
        if (servicesSubtotal > 0) {
          doc.fontSize(10)
            .fillColor('#111827')
            .text("Services Subtotal:", PAGE_WIDTH - MARGIN - 150, totalsY, { align: 'right', width: 150 })
            .text(formatCurrency(servicesSubtotal, proposal.currency), PAGE_WIDTH - MARGIN, totalsY, { align: 'right' })
          y = doc.y + 8
        }
        
        if (expensesSubtotal > 0) {
          doc.text("Expenses Subtotal:", PAGE_WIDTH - MARGIN - 150, y, { align: 'right', width: 150 })
            .text(formatCurrency(expensesSubtotal, proposal.currency), PAGE_WIDTH - MARGIN, y, { align: 'right' })
          y = doc.y + 8
        }
        
        if (clientDiscount > 0) {
          doc.fillColor('#059669')
            .text("Client Discount (on services):", PAGE_WIDTH - MARGIN - 150, y, { align: 'right', width: 150 })
            .text(`-${formatCurrency(clientDiscount, proposal.currency)}`, PAGE_WIDTH - MARGIN, y, { align: 'right' })
            .fillColor('#111827')
          y = doc.y + 8
        }
        
        if (tax > 0) {
          doc.text(`Tax (${proposal.taxRate}%) on services:`, PAGE_WIDTH - MARGIN - 150, y, { align: 'right', width: 150 })
            .text(formatCurrency(tax, proposal.currency), PAGE_WIDTH - MARGIN, y, { align: 'right' })
          y = doc.y + 8
        }
        
        // Grand total
        doc.moveTo(PAGE_WIDTH - MARGIN - 150, y)
          .lineTo(PAGE_WIDTH - MARGIN, y)
          .strokeColor('#000000')
          .lineWidth(1)
          .stroke()
        
        y += 10
        
        doc.fontSize(14)
          .text("Grand Total:", PAGE_WIDTH - MARGIN - 150, y, { align: 'right', width: 150 })
          .text(formatCurrency(grandTotal, proposal.currency), PAGE_WIDTH - MARGIN, y, { align: 'right' })
      } else if (proposal.amount) {
        checkPageBreak(doc, 30)
        doc.fontSize(14)
          .fillColor('#111827')
          .text(`Total: ${formatCurrency(proposal.amount, proposal.currency)}`, PAGE_WIDTH - MARGIN, doc.y + 10, { align: 'right' })
      }
      
      // Payment terms
      if (proposal.paymentTerms && proposal.paymentTerms.length > 0) {
        checkPageBreak(doc, 100)
        const paymentTerm = proposal.paymentTerms[0]
        y = doc.y + 20
        
        doc.rect(MARGIN, y, CONTENT_WIDTH, 80)
          .fillColor('#f9fafb')
          .fill()
          .strokeColor('#e5e7eb')
          .lineWidth(1)
          .stroke()
        
        y += 10
        
        doc.fontSize(12)
          .fillColor('#374151')
          .text("Payment Terms", MARGIN + 10, y)
        
        y = doc.y + 15
        
        doc.fontSize(10)
          .fillColor('#111827')
        
        const { upfrontType, upfrontValue, balancePaymentType, balanceDueDate, installmentType, installmentCount, installmentFrequency, recurringEnabled, recurringFrequency, recurringCustomMonths, recurringStartDate } = paymentTerm
        
        if (upfrontType && upfrontValue !== null && upfrontValue !== undefined) {
          const upfrontText = upfrontType === "PERCENT" ? `${upfrontValue}%` : formatCurrency(upfrontValue, proposal.currency)
          doc.text(`Upfront Payment: ${upfrontText}`, MARGIN + 10, y)
          y = doc.y + 8
        } else {
          doc.text("Upfront Payment: No upfront payment", MARGIN + 10, y)
          y = doc.y + 8
        }
        
        if (upfrontType && upfrontValue !== null && upfrontValue !== undefined && balancePaymentType) {
          if (balancePaymentType === "TIME_BASED" && balanceDueDate) {
            doc.text(`Balance Payment: Due on ${formatDate(balanceDueDate)}`, MARGIN + 10, y)
            y = doc.y + 8
          } else if (balancePaymentType === "MILESTONE_BASED") {
            doc.text("Balance Payment: Milestone-based", MARGIN + 10, y)
            y = doc.y + 8
          } else if (balancePaymentType === "FULL_UPFRONT") {
            doc.text("Balance Payment: Full upfront (100%)", MARGIN + 10, y)
            y = doc.y + 8
          }
        }
        
        if ((!upfrontType || upfrontValue === null || upfrontValue === undefined) && installmentType && installmentCount) {
          const freqText = installmentFrequency ? ` (${installmentFrequency.toLowerCase()})` : ''
          const typeText = installmentType === "MILESTONE_BASED" ? " - Based on milestones" : " - Time-based"
          doc.text(`Payment Schedule: ${installmentCount} payment${installmentCount > 1 ? 's' : ''}${freqText}${typeText}`, MARGIN + 10, y)
          y = doc.y + 8
        }
        
        if (recurringEnabled === true && recurringFrequency) {
          let recurringText = ""
          if (recurringFrequency === "MONTHLY_1") recurringText = "Monthly"
          else if (recurringFrequency === "MONTHLY_3") recurringText = "Every 3 months"
          else if (recurringFrequency === "MONTHLY_6") recurringText = "Every 6 months"
          else if (recurringFrequency === "YEARLY_12") recurringText = "Yearly"
          else if (recurringFrequency === "CUSTOM" && recurringCustomMonths) {
            recurringText = `Every ${recurringCustomMonths} month${recurringCustomMonths > 1 ? 's' : ''}`
          }
          if (recurringStartDate) {
            recurringText += ` - Starting ${formatDate(recurringStartDate)}`
          }
          doc.text(`Recurring Payment: ${recurringText}`, MARGIN + 10, y)
          y = doc.y + 8
        }
        
        if (!upfrontType && !installmentType && (recurringEnabled === false || recurringEnabled === null || recurringEnabled === undefined)) {
          if (balanceDueDate) {
            doc.text(`Payment Terms: Due on ${formatDate(balanceDueDate)}`, MARGIN + 10, y)
          } else {
            doc.text("Payment Terms: Paid on completion", MARGIN + 10, y)
          }
        }
      }
      
      // Footer
      checkPageBreak(doc, 30)
      doc.moveTo(MARGIN, PAGE_HEIGHT - MARGIN - 20)
        .lineTo(PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN - 20)
        .strokeColor('#e5e7eb')
        .lineWidth(0.5)
        .stroke()
      
      doc.fontSize(9)
        .fillColor('#6b7280')
        .text(`Generated on ${formatDate(new Date())}`, MARGIN, PAGE_HEIGHT - MARGIN - 15)
      
      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

// Generate Invoice PDF
export async function generateInvoicePdf(bill: any, logoBase64: string | null): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN }
      })
      
      const buffers: Buffer[] = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)
      
      let y = MARGIN
      const currency = bill.project?.currency || bill.proposal?.currency || "EUR"
      const currencySymbol = getCurrencySymbol(currency)
      
      // Calculate totals
      const subtotal = bill.subtotal || bill.items.reduce((sum: number, item: any) => sum + item.amount, 0)
      const discount = bill.discountAmount || (bill.discountPercent ? (subtotal * bill.discountPercent / 100) : 0)
      const afterDiscount = subtotal - discount
      const taxAmount = bill.taxRate && bill.taxRate > 0
        ? (bill.taxInclusive 
            ? (afterDiscount * bill.taxRate / (100 + bill.taxRate))
            : (afterDiscount * bill.taxRate / 100))
        : 0
      const total = bill.amount || (bill.taxInclusive ? afterDiscount : afterDiscount + taxAmount)
      
      // Company information (hardcoded for now)
      const companyName = "VENTURE PARTNERS ADVOGADOS"
      const companyAddress1 = "Rua Projectada à Matinha, Prédio A, 1º B"
      const companyAddress2 = "1950-327 Lisboa"
      const companyCountry = "Portugal"
      
      // Two-column header layout
      const headerLeftWidth = CONTENT_WIDTH * 0.45
      const headerRightWidth = CONTENT_WIDTH * 0.55
      const headerRightX = MARGIN + headerLeftWidth + 20
      
      // Left column: Logo + Company name
      let headerY = y
      if (logoBase64) {
        try {
          const base64Data = logoBase64.replace(/^data:image\/\w+;base64,/, "")
          const logoBuffer = Buffer.from(base64Data, 'base64')
          const mimeMatch = logoBase64.match(/^data:image\/(\w+);base64,/)
          const format = mimeMatch ? mimeMatch[1] : 'png'
          
          if (format === 'png' || format === 'jpeg' || format === 'jpg') {
            doc.image(logoBuffer, MARGIN, headerY, { 
              fit: [150, 60],
              align: 'left'
            })
            headerY += 65
          }
        } catch (error) {
          console.error("Error adding logo to PDF:", error)
        }
      }
      
      doc.fontSize(12)
        .fillColor('#111827')
        .text(companyName, MARGIN, headerY, { width: headerLeftWidth })
      
      // Right column: Title + Metadata
      const rightStartY = y
      doc.fontSize(24)
        .fillColor('#2563eb')
        .text("INVOICE", headerRightX, rightStartY, { width: headerRightWidth })
      
      let rightY = rightStartY + 35
      
      if (bill.invoiceNumber) {
        doc.fontSize(10)
          .fillColor('#111827')
          .text(`Invoice Number: ${bill.invoiceNumber}`, headerRightX, rightY, { width: headerRightWidth })
        rightY += 15
      }
      
      doc.fontSize(10)
        .fillColor('#111827')
        .text(`Issue Date: ${formatDate(bill.createdAt)}`, headerRightX, rightY, { width: headerRightWidth })
      rightY += 15
      
      const paymentDate = bill.paidAt || bill.dueDate || bill.createdAt
      doc.fontSize(10)
        .fillColor('#111827')
        .text(`Payment Date: ${formatDate(paymentDate)}`, headerRightX, rightY, { width: headerRightWidth })
      rightY += 15
      
      const currencyName = getCurrencyName(currency)
      doc.fontSize(10)
        .fillColor('#111827')
        .text(`Currency: ${currency} - ${currencyName}`, headerRightX, rightY, { width: headerRightWidth })
      
      // Set y to the bottom of the header section
      y = Math.max(headerY + 20, rightY + 10) + 20
      
      // Two-column parties section
      checkPageBreak(doc, 100)
      
      const partiesLeftWidth = CONTENT_WIDTH * 0.45
      const partiesRightWidth = CONTENT_WIDTH * 0.55
      const partiesRightX = MARGIN + partiesLeftWidth + 20
      
      // Left column: Para (To)
      doc.fontSize(12)
        .fillColor('#111827')
        .text("Bill To", MARGIN, y)
      
      let paraY = y + 18
      doc.fontSize(10)
        .fillColor('#111827')
        .text(bill.client.name, MARGIN, paraY, { width: partiesLeftWidth })
      
      if (bill.client.portugueseTaxNumber || bill.client.foreignTaxNumber) {
        paraY += 15
        const taxNumber = bill.client.portugueseTaxNumber || bill.client.foreignTaxNumber || ""
        doc.fontSize(10)
          .fillColor('#111827')
          .text(taxNumber, MARGIN, paraY, { width: partiesLeftWidth })
      }
      
      if (bill.client.billingCountry) {
        paraY += 15
        doc.fontSize(10)
          .fillColor('#111827')
          .text(bill.client.billingCountry, MARGIN, paraY, { width: partiesLeftWidth })
      }
      
      // Right column: De (From)
      doc.fontSize(12)
        .fillColor('#111827')
        .text("From", partiesRightX, y, { width: partiesRightWidth })
      
      let deY = y + 18
      doc.fontSize(10)
        .fillColor('#111827')
        .text("Venture Partners Advogados", partiesRightX, deY, { width: partiesRightWidth })
      
      deY += 15
      doc.fontSize(10)
        .fillColor('#111827')
        .text(companyAddress1, partiesRightX, deY, { width: partiesRightWidth })
      
      deY += 15
      doc.fontSize(10)
        .fillColor('#111827')
        .text(companyAddress2, partiesRightX, deY, { width: partiesRightWidth })
      
      deY += 15
      doc.fontSize(10)
        .fillColor('#111827')
        .text(companyCountry, partiesRightX, deY, { width: partiesRightWidth })
      
      y = Math.max(paraY, deY) + 20
      
      // Geral (General) Section with Line Items
      if (bill.items && bill.items.length > 0) {
        checkPageBreak(doc, 150)
        
        doc.fontSize(14)
          .fillColor('#111827')
          .text("Line Items", MARGIN, doc.y + 10)
        
        y = doc.y + 15
        
        const hasQuantity = bill.items.some((item: any) => item.quantity)
        const hasRate = bill.items.some((item: any) => item.rate || item.unitPrice)
        
        const colWidths = {
          type: CONTENT_WIDTH * 0.15,
          desc: CONTENT_WIDTH * 0.35,
          qty: hasQuantity ? CONTENT_WIDTH * 0.12 : 0,
          rate: hasRate ? CONTENT_WIDTH * 0.15 : 0,
          amount: CONTENT_WIDTH * 0.23,
        }
        
        // Adjust widths if some columns are missing
        if (!hasQuantity && !hasRate) {
          colWidths.desc = CONTENT_WIDTH * 0.55
          colWidths.amount = CONTENT_WIDTH * 0.30
        } else if (!hasQuantity) {
          colWidths.desc = CONTENT_WIDTH * 0.42
          colWidths.amount = CONTENT_WIDTH * 0.28
        } else if (!hasRate) {
          colWidths.desc = CONTENT_WIDTH * 0.47
          colWidths.amount = CONTENT_WIDTH * 0.26
        }
        
        const headerCols: Array<{ text: string; width: number; align?: 'left' | 'right' | 'center' }> = [
          { text: "Type", width: colWidths.type },
          { text: "Description", width: colWidths.desc },
        ]
        
        if (hasQuantity) headerCols.push({ text: "Quantity", width: colWidths.qty, align: 'right' })
        if (hasRate) headerCols.push({ text: "Unit Price", width: colWidths.rate, align: 'right' })
        headerCols.push({ text: "Amount", width: colWidths.amount, align: 'right' })
        
        // Table header with orange background
        const rowHeight = 25
        let x = MARGIN
        headerCols.forEach((col) => {
          doc.rect(x, y, col.width, rowHeight)
            .fillColor('#ff6b35')
            .fill()
            .strokeColor('#e5e7eb')
            .lineWidth(0.5)
            .stroke()
          
          doc.fontSize(10)
            .fillColor('#ffffff')
            .text(col.text, x + 5, y + (rowHeight / 2) - 5, {
              width: col.width - 10,
              align: col.align || 'left',
              height: rowHeight,
              valign: 'center'
            })
          
          x += col.width
        })
        
        y += rowHeight
        
        // Table rows
        bill.items.forEach((item: any) => {
          checkPageBreak(doc, 30)
          
          const rowCols: Array<{ text: string; width: number; align?: 'left' | 'right' | 'center' }> = [
            { text: item.type || "Service", width: colWidths.type },
            { text: item.description || "-", width: colWidths.desc },
          ]
          
          if (hasQuantity) rowCols.push({ text: item.quantity?.toString() || "1", width: colWidths.qty, align: 'right' })
          if (hasRate) {
            const rateValue = item.rate || item.unitPrice || 0
            rowCols.push({ text: rateValue ? formatCurrency(rateValue, currency) : "-", width: colWidths.rate, align: 'right' })
          }
          rowCols.push({ 
            text: `${item.isCredit ? '-' : ''}${formatCurrency(Math.abs(item.amount), currency)}`, 
            width: colWidths.amount, 
            align: 'right' 
          })
          
          y = drawTableRow(doc, y, rowCols)
        })
        
        // Subtotal row within the table
        checkPageBreak(doc, 30)
        const subtotalRowCols: Array<{ text: string; width: number; align?: 'left' | 'right' | 'center' }> = [
          { text: "", width: colWidths.type },
          { text: "Subtotal", width: colWidths.desc },
        ]
        
        if (hasQuantity) {
          const totalQty = bill.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
          subtotalRowCols.push({ text: totalQty.toString(), width: colWidths.qty, align: 'right' })
        }
        if (hasRate) {
          subtotalRowCols.push({ text: "", width: colWidths.rate, align: 'right' })
        }
        subtotalRowCols.push({ 
          text: formatCurrency(subtotal, currency), 
          width: colWidths.amount, 
          align: 'right' 
        })
        
        y = drawTableRow(doc, y, subtotalRowCols)
        
        y += 10
      }
      
      // Financial Summary
      checkPageBreak(doc, 100)
      
      y = doc.y + 15
      
      doc.fontSize(10)
        .fillColor('#111827')
        .text(`Subtotal: ${formatCurrency(subtotal, currency)}`, MARGIN, y)
      y = doc.y + 10
      
      if (bill.taxRate && bill.taxRate > 0 && taxAmount > 0) {
        doc.fontSize(10)
          .fillColor('#111827')
          .text(`Tax (${bill.taxRate}%): ${formatCurrency(taxAmount, currency)}`, MARGIN, y)
        y = doc.y + 10
      }
      
      doc.fontSize(12)
        .fillColor('#111827')
        .text(`Total Amount: ${formatCurrency(total, currency)}`, MARGIN, y)
      
      y = doc.y + 20
      
      // Valor Devido (Amount Due) Section
      checkPageBreak(doc, 50)
      
      doc.fontSize(14)
        .fillColor('#111827')
        .text("Amount Due", MARGIN, y)
      
      y = doc.y + 10
      
      doc.fontSize(16)
        .fillColor('#111827')
        .text(formatCurrency(total, currency), MARGIN, y)
      
      y = doc.y + 25
      
      // Notas (Notes) Section with Bank Details
      if (bill.paymentDetails) {
        checkPageBreak(doc, 80)
        
        doc.fontSize(14)
          .fillColor('#111827')
          .text("Notes:", MARGIN, y)
        
        y = doc.y + 15
        
        doc.fontSize(12)
          .fillColor('#111827')
          .text("Bank Details:", MARGIN, y)
        
        y = doc.y + 10
        
        // Parse bank details from paymentDetails.details
        const detailsText = bill.paymentDetails.details || ""
        
        // Try to extract structured information
        const nameMatch = detailsText.match(/Nome[:\s]+([^\n\r]+)/i) || 
                          detailsText.match(/Name[:\s]+([^\n\r]+)/i) ||
                          detailsText.match(/(VPA[^\n\r]+)/i)
        const ibanMatch = detailsText.match(/IBAN[:\s]+([A-Z0-9\s]+)/i)
        const bicMatch = detailsText.match(/BIC[:\s]+([A-Z0-9]+)/i) || 
                         detailsText.match(/SWIFT[:\s]+([A-Z0-9]+)/i)
        
        const bankName = nameMatch ? nameMatch[1].trim() : "VPA - Sociedade de Advogados SP RL"
        const iban = ibanMatch ? ibanMatch[1].trim() : ""
        const bic = bicMatch ? bicMatch[1].trim() : ""
        
        doc.fontSize(10)
          .fillColor('#111827')
          .text(`Name: ${bankName}`, MARGIN, y)
        
        if (iban) {
          y = doc.y + 10
          doc.fontSize(10)
            .fillColor('#111827')
            .text(`IBAN: ${iban}`, MARGIN, y)
        }
        
        if (bic) {
          y = doc.y + 10
          doc.fontSize(10)
            .fillColor('#111827')
            .text(`BIC/SWIFT: ${bic}`, MARGIN, y)
        }
        
        // If no structured data found, display as-is
        if (!iban && !bic && detailsText) {
          y = doc.y + 10
          const paymentLines = wrapText(detailsText, CONTENT_WIDTH - 20, doc)
          paymentLines.forEach(line => {
            doc.fontSize(10)
              .fillColor('#111827')
              .text(line, MARGIN, y)
            y = doc.y + 8
          })
        }
      }
      
      // Footer
      checkPageBreak(doc, 30)
      doc.moveTo(MARGIN, PAGE_HEIGHT - MARGIN - 20)
        .lineTo(PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN - 20)
        .strokeColor('#e5e7eb')
        .lineWidth(0.5)
        .stroke()
      
      doc.fontSize(9)
        .fillColor('#6b7280')
        .text(`Generated on ${formatDate(new Date())}`, MARGIN, PAGE_HEIGHT - MARGIN - 15)
      
      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}
