"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

interface DownloadPdfButtonProps {
  proposalId: string
}

export function DownloadPdfButton({ proposalId }: DownloadPdfButtonProps) {
  const handleDownload = () => {
    window.open(`/api/proposals/${proposalId}/pdf`, '_blank')
  }

  return (
    <Button onClick={handleDownload} variant="default">
      <Download className="h-4 w-4 mr-2" />
      Download PDF
    </Button>
  )
}





