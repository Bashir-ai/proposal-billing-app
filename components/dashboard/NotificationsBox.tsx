"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw } from "lucide-react"
import Link from "next/link"
import { formatDate } from "@/lib/utils"

interface Notification {
  type: string
  id: string
  itemId: string
  title: string
  proposalNumber?: string
  invoiceNumber?: string
  client?: {
    name: string
    company?: string | null
  } | null
  createdAt: string
}

interface NotificationsBoxProps {
  initialCount: number
  initialNotifications: Notification[]
}

export function NotificationsBox({ initialCount, initialNotifications }: NotificationsBoxProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
  const [count, setCount] = useState(initialCount)
  const [isOpen, setIsOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshNotifications = useCallback(async () => {
    setIsRefreshing(true)
    try {
      // Add timestamp to prevent caching
      const response = await fetch(`/api/notifications?t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
        },
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      if (data && typeof data === "object") {
        if (Array.isArray(data.notifications)) {
          setNotifications(data.notifications)
        }
        if (typeof data.count === "number") {
          setCount(data.count)
        }
      }
    } catch (error) {
      console.error("Failed to refresh notifications:", error)
      // Don't update state on error, keep existing notifications
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    // Refresh on mount to get latest data
    refreshNotifications()
    
    // Refresh notifications every 30 seconds
    const interval = setInterval(refreshNotifications, 30000)
    
    // Refresh when page becomes visible (user switches back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshNotifications()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    
    // Listen for custom refresh events (e.g., after approval)
    const handleRefreshEvent = () => {
      refreshNotifications()
    }
    window.addEventListener("notifications:refresh", handleRefreshEvent)
    
    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("notifications:refresh", handleRefreshEvent)
    }
  }, [refreshNotifications])

  const getNotificationLink = (notification: Notification): string => {
    if (notification.type === "proposal_approval" || 
        notification.type === "proposal_pending" || 
        notification.type === "proposal_pending_client") {
      return `/dashboard/proposals/${notification.itemId}`
    } else if (notification.type === "invoice_approval" || 
               notification.type === "invoice_pending") {
      return `/dashboard/bills/${notification.itemId}`
    }
    return "#"
  }

  const getNotificationLabel = (notification: Notification): string => {
    switch (notification.type) {
      case "proposal_approval":
        return "Proposal approval required"
      case "invoice_approval":
        return "Invoice approval required"
      case "proposal_pending":
        return "Proposal pending your approval"
      case "invoice_pending":
        return "Invoice pending your approval"
      case "proposal_pending_client":
        return "Proposal pending client approval"
      default:
        return "Action required"
    }
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <AlertCircle className="h-4 w-4 mr-2" />
        Notifications
        {count > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Button>

      {isOpen && (
        <Card className="absolute right-0 mt-2 w-96 z-50 max-h-96 overflow-y-auto">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Notifications</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshNotifications}
                disabled={isRefreshing}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No pending notifications
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <Link
                    key={notification.id}
                    href={getNotificationLink(notification)}
                    onClick={() => setIsOpen(false)}
                    className="block p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {getNotificationLabel(notification)}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.title}
                        </p>
                        {notification.client && (
                          <p className="text-xs text-gray-500 mt-1">
                            {notification.client.name}
                            {notification.client.company && ` • ${notification.client.company}`}
                          </p>
                        )}
                        {notification.proposalNumber && (
                          <p className="text-xs text-gray-500 mt-1">
                            {notification.proposalNumber}
                          </p>
                        )}
                        {notification.invoiceNumber && (
                          <p className="text-xs text-gray-500 mt-1">
                            {notification.invoiceNumber}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

