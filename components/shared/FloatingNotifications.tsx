"use client"

import { useState, useEffect } from "react"
import { NotificationsBox } from "@/components/dashboard/NotificationsBox"

interface FloatingNotificationsProps {
  userId: string
  userRole: string
}

export function FloatingNotifications({ userId, userRole }: FloatingNotificationsProps) {
  const [notificationsData, setNotificationsData] = useState<{
    count: number
    notifications: any[]
  }>({ count: 0, notifications: [] })
  const [loading, setLoading] = useState(true)

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

  // Don't render anything while loading to avoid layout shift
  if (loading) {
    return null
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <NotificationsBox
        initialCount={notificationsData.count}
        initialNotifications={notificationsData.notifications}
        isCollapsed={false}
        isFloating={true}
      />
    </div>
  )
}
