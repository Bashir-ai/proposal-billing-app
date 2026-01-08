import puppeteer from "puppeteer"
import { getLogoPath } from "@/lib/settings"
import { readFile } from "fs/promises"
import { join } from "path"

/**
 * Generate PDF buffer from HTML
 */
export async function generatePdfFromHTML(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  
  try {
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
  } finally {
    await browser.close()
  }
}

/**
 * Get logo as base64 string for embedding in HTML
 */
export async function getLogoBase64(): Promise<string | null> {
  try {
    const logoPath = await getLogoPath()
    if (!logoPath) return null
    
    const fullPath = join(process.cwd(), "public", logoPath)
    const logoBuffer = await readFile(fullPath)
    const logoExtension = logoPath.split(".").pop()?.toLowerCase() || "png"
    const mimeType = logoExtension === "svg" ? "image/svg+xml" : 
                    logoExtension === "jpg" || logoExtension === "jpeg" ? "image/jpeg" : 
                    "image/png"
    return `data:${mimeType};base64,${logoBuffer.toString("base64")}`
  } catch (error) {
    console.error("Error loading logo:", error)
    return null
  }
}



