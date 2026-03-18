"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Upload, X, Loader2 } from "lucide-react"
import Image from "next/image"

export function LogoUpload() {
  const [logoPath, setLogoPath] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchLogo()
  }, [])

  const fetchLogo = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/settings/logo", {
        cache: "no-store", // Ensure fresh data
      })
      if (response.ok) {
        const data = await response.json()
        setLogoPath(data?.logoPath || null)
        if (data?.logoPath) {
          setPreview(data.logoPath)
        }
      } else {
        // Don't show error for 404 (no logo set yet)
        if (response.status !== 404) {
          const errorData = await response.json().catch(() => ({ error: "Failed to load logo" }))
          console.error("Error fetching logo:", errorData)
        }
      }
    } catch (err) {
      console.error("Error fetching logo:", err)
      // Don't set error state here as it's not critical for page load
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"]
    if (!allowedTypes.includes(file.type)) {
      setError("Invalid file type. Please select a PNG, JPG, JPEG, or SVG file.")
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("File size exceeds 5MB limit. Please select a smaller file.")
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
    setError(null)
  }

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      setError("Please select a file first.")
      return
    }

    setUploading(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append("logo", file)

      const response = await fetch("/api/settings/logo", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to upload logo")
      }

      const data = await response.json()
      setLogoPath(data.logoPath)
      setSuccess("Logo uploaded successfully!")
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while uploading the logo.")
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete the logo?")) {
      return
    }

    setUploading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/settings/logo", {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete logo")
      }

      setLogoPath(null)
      setPreview(null)
      setSuccess("Logo deleted successfully!")
    } catch (err: any) {
      setError(err.message || "An error occurred while deleting the logo.")
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Logo</CardTitle>
        <CardDescription>
          Upload a logo to display on proposals, invoices, and project reports. Supported formats: PNG, JPG, JPEG, SVG (max 5MB)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4">
            <h5 className="mb-1 font-medium leading-none tracking-tight">Success</h5>
            <div className="text-sm">{success}</div>
          </div>
        )}

        {preview && (
          <div className="flex items-center justify-center p-4 border rounded-md bg-gray-50">
            <div className="relative max-w-xs">
              {preview.startsWith("data:") ? (
                // Use regular img for data URLs (file preview)
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt="Logo preview"
                  className="object-contain max-h-[100px]"
                  style={{ maxHeight: "100px" }}
                />
              ) : (
                // Use Next.js Image for actual file paths
                <Image
                  src={preview}
                  alt="Logo preview"
                  width={200}
                  height={100}
                  className="object-contain"
                  style={{ maxHeight: "100px" }}
                />
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="logo">Select Logo File</Label>
          <Input
            id="logo"
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/svg+xml"
            onChange={handleFileSelect}
            ref={fileInputRef}
            disabled={uploading}
          />
          <p className="text-xs text-gray-500">
            Accepted formats: PNG, JPG, JPEG, SVG. Maximum file size: 5MB
          </p>
        </div>

        <div className="flex space-x-2">
          <Button
            onClick={handleUpload}
            disabled={uploading || !preview || preview === logoPath}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Logo
              </>
            )}
          </Button>

          {logoPath && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={uploading}
            >
              <X className="h-4 w-4 mr-2" />
              Delete Logo
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

