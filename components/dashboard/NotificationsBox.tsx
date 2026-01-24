"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw, Check, Plus } from "lucide-react"
import Link from "next/link"
import { formatDate, cn } from "@/lib/utils"
import { ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"

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
  isCollapsed?: boolean
  isFloating?: boolean
}

export function NotificationsBox({ initialCount, initialNotifications, isCollapsed = false, isFloating = false }: NotificationsBoxProps) {
  const [notifications, setNotifications] = useState<Notification[]>(Array.isArray(initialNotifications) ? initialNotifications : [])
  const [count, setCount] = useState(initialCount)
  const [isOpen, setIsOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [viewedNotifications, setViewedNotifications] = useState<Set<string>>(new Set())

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
        } else if (typeof data.count === "number") {
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
        notification.type === "proposal_pending_client" ||
        notification.type === "proposal_pending_client_overdue") {
      return `/dashboard/proposals/${notification.itemId}`
    } else if (notification.type === "invoice_approval" || 
               notification.type === "invoice_pending") {
      return `/dashboard/bills/${notification.itemId}`
    } else if (notification.type === "todo_assignment") {
      return `/dashboard/todos`
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
      case "proposal_pending_client_overdue":
        return "Proposal pending client approval (over 5 days)"
      case "todo_assignment":
        return "ToDo assigned to you"
      default:
        return "Action required"
    }
  }

  const handleMarkAsViewed = useCallback(async (notificationId: string) => {
    try {
      // Optimistically remove from local state immediately
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      setViewedNotifications(prev => {
        const newSet = new Set(prev)
        newSet.add(notificationId)
        return newSet
      })
      
      // Mark as read in the database
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PUT",
      })
      
      if (!response.ok) {
        // If marking as read failed, restore the notification
        // We'll let the next refresh handle it
        console.error("Failed to mark notification as read")
      }
      // Don't refresh immediately - let the next automatic refresh handle it
      // This prevents the notification from reappearing
    } catch (error) {
      console.error("Error marking notification as read:", error)
      // On error, let the next refresh restore the notification if needed
    }
  }, [])

  const handleMarkAllAsViewed = useCallback(async () => {
    try {
      // Optimistically clear all notifications from local state
      const notificationsArray = Array.isArray(notifications) ? notifications : []
      const allIds = new Set(notificationsArray.map(n => n.id))
      setNotifications([])
      setViewedNotifications(allIds)
      
      // Mark all notifications as read in the database
      const promises = notificationsArray.map(n => 
        fetch(`/api/notifications/${n.id}/read`, { method: "PUT" })
      )
      await Promise.all(promises)
      
      // Don't refresh immediately - let the next automatic refresh handle it
    } catch (error) {
      console.error("Error marking all notifications as read:", error)
      // On error, let the next refresh restore notifications if needed
    }
  }, [notifications])

  // Filter out viewed notifications and calculate count
  const notificationsArray = Array.isArray(notifications) ? notifications : []
  const unviewedNotifications = notificationsArray.filter(n => !viewedNotifications.has(n.id))
  const displayCount = unviewedNotifications.length

  return (
    <div className="relative">
      <Button
        variant={displayCount > 0 ? "default" : "outline"}
        size={isFloating ? "default" : "sm"}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative shadow-lg",
          displayCount > 0 && "bg-red-600 hover:bg-red-700 text-white",
          isFloating && "h-12 px-4"
        )}
      >
        <AlertCircle className={cn("h-4 w-4", isFloating && "mr-2")} />
        {(!isCollapsed || isFloating) && "Notifications"}
        {displayCount > 0 && (
          <span className={cn(
            "absolute bg-white text-red-600 text-xs font-bold rounded-full flex items-center justify-center",
            isFloating ? "-top-2 -right-2 h-7 w-7" : isCollapsed ? "-top-1 -right-1 h-5 w-5" : "-top-2 -right-2 h-6 w-6"
          )}>
            {displayCount > 9 ? "9+" : displayCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <Card className={cn(
          "absolute w-96 z-50 max-h-96 overflow-y-auto shadow-2xl",
          isFloating 
            ? "bottom-full mb-2 right-0" 
            : isCollapsed 
              ? "mt-2 left-16" 
              : "mt-2 right-0"
        )}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Notifications</CardTitle>
              <div className="flex items-center gap-2">
                {unviewedNotifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllAsViewed}
                    className="h-8 px-2 text-xs"
                  >
                    Mark all viewed
                  </Button>
                )}
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
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {unviewedNotifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No pending notifications
              </div>
            ) : (
              <div className="divide-y">
                {Array.isArray(unviewedNotifications) && unviewedNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    getNotificationLabel={getNotificationLabel}
                    getNotificationLink={getNotificationLink}
                    onClose={() => setIsOpen(false)}
                    onMarkAsViewed={() => handleMarkAsViewed(notification.id)}
                    isViewed={viewedNotifications.has(notification.id)}
                    onTodoCreated={() => {
                      refreshNotifications()
                      toast.success("Todo created from notification")
                    }}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function NotificationItem({
  notification,
  getNotificationLabel,
  getNotificationLink,
  onClose,
  onMarkAsViewed,
  isViewed,
  onTodoCreated,
}: {
  notification: Notification
  getNotificationLabel: (notification: Notification) => string
  getNotificationLink: (notification: Notification) => string
  onClose: () => void
  onMarkAsViewed?: () => void
  isViewed?: boolean
  onTodoCreated?: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCreatingTodo, setIsCreatingTodo] = useState(false)
  const link = getNotificationLink(notification)

  const handleMarkAsViewed = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await onMarkAsViewed?.()
  }

  const handleCreateTodo = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsCreatingTodo(true)
    try {
      const response = await fetch("/api/notifications/create-todo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationId: notification.id,
          notificationType: notification.type,
          itemId: notification.itemId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create todo")
      }

      onTodoCreated?.()
    } catch (error: any) {
      console.error("Error creating todo:", error)
      toast.error(error.message || "Failed to create todo from notification")
    } finally {
      setIsCreatingTodo(false)
    }
  }

  return (
    <div className={cn("block", isViewed && "opacity-60")}>
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "p-4 hover:bg-gray-50 transition-colors cursor-pointer",
          isViewed && "bg-gray-50"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900">
                {getNotificationLabel(notification)}
              </p>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {notification.title}
            </p>
            {isExpanded && (
              <div className="mt-2 space-y-1">
                {notification.client && (
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">Client:</span> {notification.client.name}
                    {notification.client.company && ` • ${notification.client.company}`}
                  </p>
                )}
                {notification.proposalNumber && (
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">Proposal:</span> {notification.proposalNumber}
                  </p>
                )}
                {notification.invoiceNumber && (
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">Invoice:</span> {notification.invoiceNumber}
                  </p>
                )}
                <p className="text-xs text-gray-400">
                  {formatDate(notification.createdAt)}
                </p>
              </div>
            )}
            {!isExpanded && (
              <p className="text-xs text-gray-400 mt-1">
                {formatDate(notification.createdAt)}
              </p>
            )}
          </div>
          {onMarkAsViewed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAsViewed}
              className="h-7 w-7 p-0 flex-shrink-0"
              title="Mark as viewed"
            >
              <Check className="h-4 w-4 text-gray-500" />
            </Button>
          )}
        </div>
      </div>
      <div className="px-4 pb-2 flex items-center justify-between gap-2">
        {link !== "#" && (
          <Link
            href={link}
            onClick={onClose}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            View Details →
          </Link>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleCreateTodo}
          disabled={isCreatingTodo}
          className="h-7 px-2 text-xs"
          title="Create Todo from this notification"
        >
          <Plus className="h-3 w-3 mr-1" />
          {isCreatingTodo ? "Creating..." : "Create Todo"}
        </Button>
      </div>
    </div>
  )
}

