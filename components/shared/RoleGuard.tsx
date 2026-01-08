"use client"

import { useSession } from "next-auth/react"
import { UserRole } from "@prisma/client"
import { redirect } from "next/navigation"

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
  fallback?: React.ReactNode
}

export function RoleGuard({ children, allowedRoles, fallback }: RoleGuardProps) {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <div>Loading...</div>
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









