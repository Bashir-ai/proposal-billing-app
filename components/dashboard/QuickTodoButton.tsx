"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { QuickTodoDialog } from "@/components/todos/QuickTodoDialog"

interface QuickTodoButtonProps {
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost" | "link"
  className?: string
  children?: React.ReactNode
}

export function QuickTodoButton({ 
  variant = "outline", 
  className = "w-full",
  children 
}: QuickTodoButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Button
        onClick={() => setDialogOpen(true)}
        variant={variant}
        className={className}
      >
        {children || (
          <>
            <Plus className="h-4 w-4 mr-2" />
            Create ToDo
          </>
        )}
      </Button>
      <QuickTodoDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}

