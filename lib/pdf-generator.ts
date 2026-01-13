import { prisma } from "@/lib/prisma"

// Use puppeteer-core for serverless environments
let puppeteer: any
if (process.env.VERCEL) {
  puppeteer = require("puppeteer-core")
} else {
  puppeteer = require("puppeteer")
}

/**
 * Generate PDF buffer from HTML
 */
export async function generatePdfFromHTML(html: string): Promise<Buffer> {
  let browser: any = null
  
  try {
    const launchOptions: any = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    }

    // Use @sparticuz/chromium for Vercel serverless
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      try {
        // Use require to ensure proper module resolution in serverless
        const chromium = require("@sparticuz/chromium")
        // Disable font loading for faster startup (if method exists)
        if (typeof chromium.setGraphicsMode === 'function') {
          chromium.setGraphicsMode(false)
        }
        
        // Get executable path - chromium handles extraction automatically to /tmp
        // The executablePath() method should extract chromium to a temp directory
        const executablePath = await chromium.executablePath()
        
        if (!executablePath) {
          throw new Error("Failed to get chromium executable path")
        }
        
        launchOptions.executablePath = executablePath
        launchOptions.args = [
          ...chromium.args,
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-software-rasterizer',
          '--single-process', // Required for serverless
        ]
        launchOptions.defaultViewport = chromium.defaultViewport
      } catch (chromiumError: any) {
        console.error("Could not load @sparticuz/chromium, PDF generation may fail:", chromiumError)
        // In Vercel, we must have chromium
        if (process.env.VERCEL) {
          throw new Error(`PDF generation not available in serverless environment: ${chromiumError.message}`)
        }
        // In other production environments, try without chromium (may fail)
        console.warn("Continuing without chromium - PDF generation may fail")
      }
    }

    browser = await puppeteer.launch(launchOptions)
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    })
    
    return Buffer.from(pdf)
  } catch (error) {
    console.error("Error generating PDF:", error)
    throw error
  } finally {
    if (browser) {
      await browser.close().catch(console.error)
    }
  }
}

/**
 * Get logo as base64 string for embedding in HTML
 * Logo is stored as base64 in the database, not as a file
 */
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

    // Logo is already stored as base64 in the database
    // Just return it as a data URL
    return `data:${settings.logoMimeType};base64,${settings.logoData}`
  } catch (error: any) {
    // Don't throw error, just log and return null - logo is optional
    console.error("Error loading logo:", error)
    return null
  }
}



