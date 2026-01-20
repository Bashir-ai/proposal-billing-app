"use client"

import { useState, useEffect } from "react"
import { NotificationsBox } from "@/components/dashboard/NotificationsBox"
import { Button } from "@/components/ui/button"
import { ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface FloatingNotificationsProps {
  userId: string
  userRole: string
}

type NotificationPosition = "bottom" | "top"

export function FloatingNotifications({ userId, userRole }: FloatingNotificationsProps) {
  const [notificationsData, setNotificationsData] = useState<{
    count: number
    notifications: any[]
  }>({ count: 0, notifications: [] })
  const [loading, setLoading] = useState(true)
  const [position, setPosition] = useState<NotificationPosition>(() => {
    // Load from localStorage or default to bottom
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("notificationPosition")
      return (saved === "top" || saved === "bottom") ? saved : "bottom"
    }
    return "bottom"
  })

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/notifications?t=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
          },
        })
        if (response.ok) {
          const data = await response.json()
          if (Array.isArray(data.notifications)) {
            setNotificationsData({
              count: data.count || 0,
              notifications: data.notifications || [],
            })
          }
        }
      } catch (error) {
        console.error("Failed to fetch notifications:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000) // Refresh every 30 seconds

    // Listen for refresh events
    const handleRefresh = () => {
      fetchNotifications()
    }
    window.addEventListener("notifications:refresh", handleRefresh)

    return () => {
      clearInterval(interval)
      window.removeEventListener("notifications:refresh", handleRefresh)
    }
  }, [userId, userRole])

  const togglePosition = () => {
    const newPosition: NotificationPosition = position === "bottom" ? "top" : "bottom"
    setPosition(newPosition)
    if (typeof window !== "undefined") {
      localStorage.setItem("notificationPosition", newPosition)
    }
  }

  // Don't render anything while loading to avoid layout shift
  if (loading) {
    return null
  }

  return (
    <div className={cn(
      "fixed right-6 z-50 flex flex-col items-end gap-2",
      position === "bottom" ? "bottom-6" : "top-6"
    )}>
      <Button
        variant="outline"
        size="sm"
        onClick={togglePosition}
        className="h-8 w-8 p-0 shadow-md"
        title={position === "bottom" ? "Move to top" : "Move to bottom"}
      >
        {position === "bottom" ? (
          <ArrowUp className="h-4 w-4" />
        ) : (
          <ArrowDown className="h-4 w-4" />
        )}
      </Button>
      <NotificationsBox
        initialCount={notificationsData.count}
        initialNotifications={notificationsData.notifications}
        isCollapsed={false}
        isFloating={true}
      />
    </div>
  )
}
