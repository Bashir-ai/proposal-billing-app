"use client"

import { useSession } from "next-auth/react"
import { UserRole } from "@prisma/client"
import { redirect } from "next/navigation"
import { LoadingState } from "./LoadingState"

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
  fallback?: React.ReactNode
}

export function RoleGuard({ children, allowedRoles, fallback }: RoleGuardProps) {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <LoadingState message="Checking permissions..." />
  }

  if (!session) {
    redirect("/login")
    return null
  }

  if (!allowedRoles.includes(session.user.role)) {
    return fallback || <div>Access denied</div>
  }

  return <>{children}</>
}









