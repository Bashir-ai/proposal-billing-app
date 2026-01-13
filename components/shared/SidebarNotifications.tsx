"use client"

import { useState, useEffect } from "react"
import { NotificationsBox } from "@/components/dashboard/NotificationsBox"

interface SidebarNotificationsProps {
  isCollapsed: boolean
}

export function SidebarNotifications({ isCollapsed }: SidebarNotificationsProps) {
  const [notificationsData, setNotificationsData] = useState<{
    count: number
    notifications: any[]
  }>({ count: 0, notifications: [] })

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await fetch(`/api/notifications?t=${Date.now()}`, {
          cache: "no-store",
        })
        if (response.ok) {
          const data = await response.json()
          setNotificationsData(data)
        }
      } catch (error) {
        console.error("Failed to fetch notifications:", error)
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
  }, [])

  return (
    <NotificationsBox
      initialCount={notificationsData.count}
      initialNotifications={notificationsData.notifications}
      isCollapsed={isCollapsed}
    />
  )
}
