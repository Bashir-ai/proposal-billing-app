"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw, Check, Plus } from "lucide-react"
import Link from "next/link"
import { formatDate, formatClientName, cn } from "@/lib/utils"
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
    clientCode?: number | null
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
  // Load viewed notifications from localStorage on mount
  const initialViewedNotifications = (() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('viewedNotifications')
        return stored ? new Set(JSON.parse(stored)) : new Set()
      } catch (error) {
        console.error("Error loading viewed notifications from localStorage:", error)
        return new Set()
      }
    }
    return new Set()
  })()

  // Filter initial notifications using viewedNotifications Set
  const initialNotificationsArray = Array.isArray(initialNotifications) ? initialNotifications : []
  const filteredInitialNotifications = initialNotificationsArray.filter(n => !initialViewedNotifications.has(n.id))
  
  const [notifications, setNotifications] = useState<Notification[]>(filteredInitialNotifications)
  const [count, setCount] = useState(filteredInitialNotifications.length)
  const [isOpen, setIsOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [viewedNotifications, setViewedNotifications] = useState<Set<string>>(initialViewedNotifications)

  // Use a ref to track viewedNotifications for use in callbacks
  const viewedNotificationsRef = useRef(viewedNotifications)
  
  // Update ref when viewedNotifications changes
  useEffect(() => {
    viewedNotificationsRef.current = viewedNotifications
  }, [viewedNotifications])

  // Save to localStorage whenever viewedNotifications changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('viewedNotifications', JSON.stringify(Array.from(viewedNotifications)))
      } catch (error) {
        console.error("Error saving viewed notifications to localStorage:", error)
        // localStorage might be full or disabled, continue without it
      }
    }
  }, [viewedNotifications])

  const refreshNotifications = useCallback(async () => {
    setIsRefreshing(true)
    try {
      // Fetch read notification records to sync with database state first
      let databaseReadIds: string[] = []
      try {
        const readResponse = await fetch(`/api/notifications/read-status?t=${Date.now()}`, {
          cache: "no-store",
        })
        if (readResponse.ok) {
          const readData = await readResponse.json()
          if (readData && Array.isArray(readData.readIds)) {
            databaseReadIds = readData.readIds
          }
        }
      } catch (error) {
        // If fetching read status fails, continue with existing viewedNotifications
        console.error("Failed to fetch read notification status:", error)
      }

      // Merge database read state with local viewedNotifications
      const mergedReadSet = new Set<string>()
      // Add existing viewed notifications
      viewedNotificationsRef.current.forEach(id => mergedReadSet.add(id))
      // Add database read IDs
      databaseReadIds.forEach((id: string) => mergedReadSet.add(id))
      
      // Update state with merged set
      setViewedNotifications(mergedReadSet)

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
          // Filter notifications using the merged read set
          // The API already filters out read notifications, but we double-check here
          const filteredNotifications = data.notifications.filter((n: Notification) => !mergedReadSet.has(n.id))
          setNotifications(filteredNotifications)
          
          // Update count based on filtered notifications
          setCount(filteredNotifications.length)
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
        console.error("Failed to mark notification as read")
        // Restore notification by removing from viewed set
        setViewedNotifications(prev => {
          const newSet = new Set(prev)
          newSet.delete(notificationId)
          return newSet
        })
        // Trigger a refresh to restore the notification
        setTimeout(() => refreshNotifications(), 100)
      } else {
        // Update the ref immediately so subsequent refreshes respect this
        viewedNotificationsRef.current.add(notificationId)
      }
    } catch (error) {
      console.error("Error marking notification as read:", error)
      // On error, restore notification by removing from viewed set
      setViewedNotifications(prev => {
        const newSet = new Set(prev)
        newSet.delete(notificationId)
        return newSet
      })
      // Trigger a refresh to restore the notification
      setTimeout(() => refreshNotifications(), 100)
    }
  }, [refreshNotifications])

  const handleMarkAllAsViewed = useCallback(async () => {
    try {
      // Optimistically clear all notifications from local state
      const notificationsArray = Array.isArray(notifications) ? notifications : []
      const allIds = new Set(notificationsArray.map(n => n.id))
      setNotifications([])
      setViewedNotifications(prev => {
        const merged = new Set(prev)
        allIds.forEach(id => merged.add(id))
        return merged
      })
      
      // Update ref immediately
      allIds.forEach(id => viewedNotificationsRef.current.add(id))
      
      // Mark all notifications as read in the database
      const promises = notificationsArray.map(n => 
        fetch(`/api/notifications/${n.id}/read`, { method: "PUT" })
      )
      const results = await Promise.allSettled(promises)
      
      // Check if any failed
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok))
      if (failed.length > 0) {
        console.error("Some notifications failed to mark as read")
        // Refresh to restore any that failed
        setTimeout(() => refreshNotifications(), 100)
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error)
      // On error, refresh to restore notifications
      setTimeout(() => refreshNotifications(), 100)
    }
  }, [notifications, refreshNotifications])

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
          "absolute w-80 z-50 max-h-96 overflow-y-auto shadow-2xl",
          isFloating 
            ? "bottom-full mb-2 right-0" 
            : isCollapsed 
              ? "mt-2 left-16" 
              : "mt-2 right-0"
        )}>
          <CardHeader className="p-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Notifications</CardTitle>
              <div className="flex items-center gap-2">
                {unviewedNotifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllAsViewed}
                    className="h-7 px-2 text-xs"
                  >
                    Mark all viewed
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshNotifications}
                  disabled={isRefreshing}
                  className="h-7 w-7 p-0"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {unviewedNotifications.length === 0 ? (
              <div className="p-3 text-center text-gray-500 text-xs">
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
          "p-3 hover:bg-gray-50 transition-colors cursor-pointer",
          isViewed && "bg-gray-50"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-gray-900">
                {getNotificationLabel(notification)}
              </p>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {notification.title}
            </p>
            {isExpanded && (
              <div className="mt-2 space-y-1">
                {notification.client && (
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">Client:</span> {formatClientName(notification.client)}
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
              className="h-6 w-6 p-0 flex-shrink-0"
              title="Mark as viewed"
            >
              <Check className="h-3.5 w-3.5 text-gray-500" />
            </Button>
          )}
        </div>
      </div>
      <div className="px-3 pb-2 flex items-center justify-between gap-2">
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
          className="h-6 px-2 text-xs"
          title="Create Todo from this notification"
        >
          <Plus className="h-3 w-3 mr-1" />
          {isCreatingTodo ? "Creating..." : "Create Todo"}
        </Button>
      </div>
    </div>
  )
}

