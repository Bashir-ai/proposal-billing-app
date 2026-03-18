"use client"

import { useRouter } from "next/navigation"
import { QuickInvoiceInteractionButton } from "./QuickInvoiceInteractionButton"
import { InteractionType } from "@prisma/client"

interface QuickInvoiceInteractionWrapperProps {
  billId: string
  interactionType: InteractionType
  label: string
}

export function QuickInvoiceInteractionWrapper({
  billId,
  interactionType,
  label,
}: QuickInvoiceInteractionWrapperProps) {
  const router = useRouter()

  const handleInteractionCreated = () => {
    // Refresh the page to show new interaction
    router.refresh()
  }

  return (
    <QuickInvoiceInteractionButton
      billId={billId}
      interactionType={interactionType}
      label={label}
      onInteractionCreated={handleInteractionCreated}
    />
  )
}
