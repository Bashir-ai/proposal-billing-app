"use client"

import * as React from "react"

interface SidebarContextType {
  isCollapsed: boolean
  isMobileOpen: boolean
  toggle: () => void
  setMobileOpen: (open: boolean) => void
}

const SidebarContext = React.createContext<SidebarContextType | undefined>(undefined)

const SIDEBAR_STORAGE_KEY = "sidebar-collapsed"

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = React.useState(false)
  const [isMobileOpen, setIsMobileOpen] = React.useState(false)
  const [isHydrated, setIsHydrated] = React.useState(false)

  // Load initial state from localStorage
  React.useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (stored !== null) {
      setIsCollapsed(stored === "true")
    }
    setIsHydrated(true)
  }, [])

  const toggle = React.useCallback(() => {
    setIsCollapsed((prev) => {
      const newValue = !prev
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(newValue))
      return newValue
    })
  }, [])

  const setMobileOpen = React.useCallback((open: boolean) => {
    setIsMobileOpen(open)
  }, [])

  // Prevent hydration mismatch by not rendering until hydrated
  if (!isHydrated) {
    return (
      <SidebarContext.Provider
        value={{ isCollapsed: false, isMobileOpen: false, toggle: () => {}, setMobileOpen: () => {} }}
      >
        {children}
      </SidebarContext.Provider>
    )
  }

  return (
    <SidebarContext.Provider
      value={{ isCollapsed, isMobileOpen, toggle, setMobileOpen }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}
