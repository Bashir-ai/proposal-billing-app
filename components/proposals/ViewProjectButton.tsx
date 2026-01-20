"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface ViewProjectButtonProps {
  projectId: string
}

export function ViewProjectButton({ projectId }: ViewProjectButtonProps) {
  const router = useRouter()

  return (
    <Button 
      variant="outline"
      onClick={() => {
        router.push(`/projects/${projectId}`)
      }}
    >
      View Project
    </Button>
  )
}

