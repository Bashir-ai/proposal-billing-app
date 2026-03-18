"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"

interface ConvertLeadDialogProps {
  leadId: string
  leadName: string
  onClose: () => void
}

export function ConvertLeadDialog({
  leadId,
  leadName,
  onClose,
}: ConvertLeadDialogProps) {
  const router = useRouter()
  const [keepLeadRecord, setKeepLeadRecord] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleConvert = async () => {
    setError("")
    setLoading(true)

    try {
      const response = await fetch(`/api/leads/${leadId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keepLeadRecord,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to convert lead")
      }

      const data = await response.json()
      router.push(`/dashboard/clients/${data.client.id}`)
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-blue-900">Convert Lead to Client</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription className="text-blue-700">
          Convert &quot;{leadName}&quot; from a lead to a client. All lead information will be transferred to the new client record.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="keepLeadRecord"
              checked={keepLeadRecord}
              onCheckedChange={(checked) => setKeepLeadRecord(checked === true)}
            />
            <Label htmlFor="keepLeadRecord" className="cursor-pointer">
              Keep lead record after conversion
            </Label>
          </div>

          {error && (
            <div className="p-3 bg-red-100 border border-red-300 rounded text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="flex space-x-2">
            <Button
              onClick={handleConvert}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? "Converting..." : "Convert to Client"}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

