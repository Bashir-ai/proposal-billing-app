"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

interface DownloadPdfButtonProps {
  billId: string
}

export function DownloadPdfButton({ billId }: DownloadPdfButtonProps) {
  const handleDownload = () => {
    window.open(`/api/bills/${billId}/pdf`, '_blank')
  }

  return (
    <Button onClick={handleDownload} variant="default">
      <Download className="h-4 w-4 mr-2" />
      Download PDF
    </Button>
  )
}


