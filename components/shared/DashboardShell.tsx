"use client"

import * as React from "react"
import { UserRole } from "@prisma/client"
import { cn } from "@/lib/utils"
import { SidebarProvider, useSidebar } from "./SidebarContext"
import { Sidebar } from "./Sidebar"
import { MobileHeader } from "./MobileSidebar"

interface User {
  id: string
  email: string
  name: string
  role: UserRole
}

interface DashboardShellProps {
  user: User
  children: React.ReactNode
}

function DashboardShellContent({ user, children }: DashboardShellProps) {
  const { isCollapsed } = useSidebar()

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          user={user}
          isCollapsed={isCollapsed}
          onToggle={useSidebar().toggle}
        />
      </div>

      {/* Mobile Header & Sheet */}
      <MobileHeader user={user} />

      {/* Main Content */}
      <main
        className={cn(
          "min-h-screen transition-all duration-300 ease-in-out",
          "lg:pl-60", // Default sidebar width
          isCollapsed && "lg:pl-16", // Collapsed sidebar width
          "pt-14 lg:pt-0" // Top padding for mobile header
        )}
      >
        <div className="container mx-auto py-6 px-4 lg:py-8 lg:px-6">
          {children}
        </div>
      </main>
    </div>
  )
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  return (
    <SidebarProvider>
      <DashboardShellContent user={user}>{children}</DashboardShellContent>
    </SidebarProvider>
  )
}
