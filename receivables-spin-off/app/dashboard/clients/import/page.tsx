"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Upload, FileSpreadsheet, FileText, ArrowLeft, CheckCircle, XCircle } from "lucide-react"
import Papa from "papaparse"
import * as XLSX from "xlsx"
import Link from "next/link"

interface ParsedRow {
  [key: string]: string | number | null
}

interface ColumnMapping {
  name?: string
  email?: string
  company?: string
  contactInfo?: string
  portugueseTaxNumber?: string
  foreignTaxNumber?: string
  kycCompleted?: string
}

const AVAILABLE_FIELDS = [
  { value: "", label: "Skip column" },
  { value: "name", label: "Name (required)" },
  { value: "email", label: "Email" },
  { value: "company", label: "Company" },
  { value: "contactInfo", label: "Contact Info" },
  { value: "portugueseTaxNumber", label: "Portuguese Tax Number" },
  { value: "foreignTaxNumber", label: "Foreign Tax Number" },
  { value: "kycCompleted", label: "KYC Completed (true/false)" },
]

export default function ImportClientsPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<"csv" | "xlsx" | null>(null)
  const [rawData, setRawData] = useState<ParsedRow[]>([])
  const [headerRowIndex, setHeaderRowIndex] = useState(0)
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({})
  const [previewData, setPreviewData] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<{
    success: number
    failed: number
    errors: Array<{ row: number; error: string }>
  } | null>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setFileType(selectedFile.name.endsWith(".xlsx") || selectedFile.name.endsWith(".xls") ? "xlsx" : "csv")
    setImportResults(null)

    // Parse file
    if (selectedFile.name.endsWith(".xlsx") || selectedFile.name.endsWith(".xls")) {
      // Parse Excel
      const reader = new FileReader()
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: null }) as any[][]
        
        // Convert to array of objects where each row is an object with numeric keys
        // This allows us to select which row is the header
        const rows: ParsedRow[] = jsonData.map((row) => {
          const obj: ParsedRow = {}
          row.forEach((cell, index) => {
            obj[`_col_${index}`] = cell ?? null
          })
          return obj
        })
        
        setRawData(rows)
      }
      reader.readAsArrayBuffer(selectedFile)
    } else {
      // Parse CSV
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setRawData(results.data as ParsedRow[])
        },
        error: (error) => {
          console.error("CSV parsing error:", error)
          alert("Error parsing CSV file: " + error.message)
        },
      })
    }
  }

  const getHeadersFromRow = (row: ParsedRow): string[] => {
    if (fileType === "xlsx") {
      // For Excel, extract column values from the header row
      const headers: string[] = []
      Object.keys(row)
        .filter((key) => key.startsWith("_col_"))
        .sort((a, b) => {
          const indexA = parseInt(a.replace("_col_", ""))
          const indexB = parseInt(b.replace("_col_", ""))
          return indexA - indexB
        })
        .forEach((key) => {
          const colIndex = parseInt(key.replace("_col_", ""))
          const headerValue = String(row[key] || `Column ${colIndex + 1}`)
          headers[colIndex] = headerValue
        })
      return headers.filter((h) => h) // Remove empty entries
    } else {
      // For CSV, headers are already the keys
      return Object.keys(row)
    }
  }

  const getValueFromRow = (row: ParsedRow, header: string, colIndex: number): any => {
    if (fileType === "xlsx") {
      return row[`_col_${colIndex}`]
    } else {
      return row[header]
    }
  }

  const updatePreview = () => {
    if (rawData.length === 0) return

    // Get headers from the selected header row
    const headerRow = rawData[headerRowIndex] || rawData[0] || {}
    const headers = getHeadersFromRow(headerRow)
    
    // Map columns based on current mapping
    const mapped = rawData.slice(headerRowIndex + 1, headerRowIndex + 6).map((row, idx) => {
      const mappedRow: any = {}
      headers.forEach((header, colIndex) => {
        if (!header) return
        const field = columnMapping[header as keyof ColumnMapping]
        if (field && field !== "") {
          let value = getValueFromRow(row, header, colIndex)
          if (value === null || value === undefined || value === "") {
            value = null
          } else if (field === "kycCompleted") {
            // Convert to boolean
            value = String(value).toLowerCase() === "true" || String(value).toLowerCase() === "yes" || String(value) === "1"
          } else {
            value = String(value).trim()
          }
          mappedRow[field] = value
        }
      })
      return { ...mappedRow, _rowIndex: headerRowIndex + idx + 2 }
    })

    setPreviewData(mapped)
  }

  const handleColumnMappingChange = (columnName: string, field: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [columnName]: field,
    }))
  }

  // Update preview when mapping or header row changes
  useEffect(() => {
    if (rawData.length > 0) {
      updatePreview()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnMapping, headerRowIndex])

  const handleImport = async () => {
    if (!file || rawData.length === 0) return

    // Validate that name is mapped
    const nameMapped = Object.values(columnMapping).includes("name")
    if (!nameMapped) {
      alert("Please map at least the 'Name' column")
      return
    }

    setImporting(true)
    setImportResults(null)

    try {
      // Prepare data for import
      const headerRow = rawData[headerRowIndex] || rawData[0] || {}
      const headers = getHeadersFromRow(headerRow)
      
      const clientsToImport = rawData.slice(headerRowIndex + 1).map((row) => {
        const client: any = {}
        headers.forEach((header, colIndex) => {
          if (!header) return
          const field = columnMapping[header as keyof ColumnMapping]
          if (field && field !== "") {
            let value = getValueFromRow(row, header, colIndex)
            if (value === null || value === undefined || value === "") {
              value = null
            } else if (field === "kycCompleted") {
              value = String(value).toLowerCase() === "true" || String(value).toLowerCase() === "yes" || String(value) === "1"
            } else {
              value = String(value).trim()
            }
            client[field] = value
          }
        })
        return client
      }).filter((client) => client.name) // Only include clients with names

      const response = await fetch("/api/clients/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clients: clientsToImport }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || "Import failed")
        setImporting(false)
        return
      }

      setImportResults(data.results)
      setImporting(false)
    } catch (error) {
      console.error("Import error:", error)
      alert("An error occurred during import")
      setImporting(false)
    }
  }

  // Get headers for column mapping
  const getHeaders = () => {
    if (rawData.length === 0) return []
    const headerRow = rawData[headerRowIndex] || rawData[0] || {}
    return getHeadersFromRow(headerRow)
  }
  
  const headers = getHeaders()

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Import Clients</h1>
          <p className="text-gray-600 mt-2">Upload a CSV or Excel file to import multiple clients at once</p>
        </div>
        <Link href="/dashboard/clients">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Button>
        </Link>
      </div>

      <div className="space-y-6">
        {/* File Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Upload File</CardTitle>
            <CardDescription>Select a CSV or Excel file containing client data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {!file ? (
                  <div>
                    <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                    >
                      Select File
                    </Button>
                    <p className="text-sm text-gray-500 mt-2">
                      Supports CSV, XLS, and XLSX files
                    </p>
                  </div>
                ) : (
                  <div>
                    {fileType === "xlsx" ? (
                      <FileSpreadsheet className="mx-auto h-12 w-12 text-green-500 mb-4" />
                    ) : (
                      <FileText className="mx-auto h-12 w-12 text-blue-500 mb-4" />
                    )}
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500 mt-2">
                      {rawData.length} rows found
                    </p>
                    <Button
                      onClick={() => {
                        setFile(null)
                        setRawData([])
                        setColumnMapping({})
                        setPreviewData([])
                        setHeaderRowIndex(0)
                        if (fileInputRef.current) {
                          fileInputRef.current.value = ""
                        }
                      }}
                      variant="outline"
                      className="mt-4"
                    >
                      Change File
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Header Row Selection */}
        {rawData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Select Header Row</CardTitle>
              <CardDescription>Choose which row contains the column headers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Header Row</Label>
                <Select
                  value={headerRowIndex.toString()}
                  onChange={(e) => {
                    const newIndex = parseInt(e.target.value)
                    setHeaderRowIndex(newIndex)
                    setColumnMapping({})
                    setTimeout(() => updatePreview(), 100)
                  }}
                >
                  {rawData.slice(0, 10).map((_, index) => (
                    <option key={index} value={index}>
                      Row {index + 1}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-gray-500 mt-2">
                  Preview of selected row: {fileType === "xlsx" 
                    ? getHeadersFromRow(rawData[headerRowIndex] || {}).join(", ")
                    : Object.values(rawData[headerRowIndex] || {}).slice(0, 5).join(", ") + "..."
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Column Mapping */}
        {rawData.length > 0 && headers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Map Columns</CardTitle>
              <CardDescription>Match your file columns to client fields</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {headers.map((header) => (
                    <div key={header} className="space-y-2">
                      <Label>{header}</Label>
                      <Select
                        value={columnMapping[header as keyof ColumnMapping] || ""}
                        onChange={(e) => {
                          handleColumnMappingChange(header, e.target.value)
                          setTimeout(() => updatePreview(), 100)
                        }}
                      >
                        {AVAILABLE_FIELDS.map((field) => (
                          <option key={field.value} value={field.value}>
                            {field.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview */}
        {previewData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 4: Preview</CardTitle>
              <CardDescription>Review how your data will be imported</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      {Object.keys(previewData[0] || {}).filter((key) => key !== "_rowIndex").map((key) => (
                        <th key={key} className="border border-gray-300 px-4 py-2 text-left">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, idx) => (
                      <tr key={idx}>
                        {Object.keys(row)
                          .filter((key) => key !== "_rowIndex")
                          .map((key) => (
                            <td key={key} className="border border-gray-300 px-4 py-2">
                              {String(row[key] ?? "")}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Showing first 5 rows. Total rows to import: {rawData.length - headerRowIndex - 1}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Import Button */}
        {rawData.length > 0 && Object.values(columnMapping).includes("name") && (
          <Card>
            <CardContent className="pt-6">
              <Button
                onClick={handleImport}
                disabled={importing}
                className="w-full"
                size="lg"
              >
                {importing ? "Importing..." : `Import ${rawData.length - headerRowIndex - 1} Clients`}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Import Results */}
        {importResults && (
          <Card>
            <CardHeader>
              <CardTitle>Import Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-semibold">{importResults.success} successful</span>
                  </div>
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-5 w-5" />
                    <span className="font-semibold">{importResults.failed} failed</span>
                  </div>
                </div>

                {importResults.errors.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2">Errors:</h4>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {importResults.errors.map((error, idx) => (
                        <div key={idx} className="text-sm text-red-600">
                          Row {error.row}: {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-6">
                  <Link href="/dashboard/clients" className="flex-1">
                    <Button className="w-full">View Clients</Button>
                  </Link>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null)
                      setRawData([])
                      setColumnMapping({})
                      setPreviewData([])
                      setHeaderRowIndex(0)
                      setImportResults(null)
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ""
                      }
                    }}
                  >
                    Import Another File
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

