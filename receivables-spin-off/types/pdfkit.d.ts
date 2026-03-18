declare module 'pdfkit' {
  interface PDFDocumentOptions {
    size?: string | [number, number]
    margins?: { top?: number; bottom?: number; left?: number; right?: number }
    layout?: 'portrait' | 'landscape'
    bufferPages?: boolean
    autoFirstPage?: boolean
  }

  class PDFDocument {
    constructor(options?: PDFDocumentOptions)
    on(event: 'data', callback: (chunk: Buffer) => void): void
    on(event: 'end', callback: () => void): void
    on(event: 'error', callback: (error: Error) => void): void
    fontSize(size: number): PDFDocument
    font(font: string): PDFDocument
    fillColor(color: string): PDFDocument
    text(text: string, x?: number, y?: number, options?: { width?: number; align?: 'left' | 'right' | 'center' | 'justify'; height?: number; valign?: 'top' | 'center' | 'bottom' }): PDFDocument
    image(src: Buffer | string, x?: number, y?: number, options?: { fit?: [number, number]; width?: number; height?: number; align?: 'left' | 'right' | 'center' }): PDFDocument
    moveDown(lines?: number): PDFDocument
    moveTo(x: number, y: number): PDFDocument
    lineTo(x: number, y: number): PDFDocument
    rect(x: number, y: number, width: number, height: number): PDFDocument
    fill(): PDFDocument
    stroke(): PDFDocument
    strokeColor(color: string): PDFDocument
    lineWidth(width: number): PDFDocument
    addPage(): PDFDocument
    end(): void
    y: number
    widthOfString(text: string, options?: { width?: number }): number
  }

  export = PDFDocument
}
