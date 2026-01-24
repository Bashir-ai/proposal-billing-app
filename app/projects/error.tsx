"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ProjectsError({ error, reset }: ErrorProps) {
  const router = useRouter()

  useEffect(() => {
    // Don't log Next.js redirect errors - they're expected behavior
    if (error.digest && error.digest.startsWith('NEXT_REDIRECT')) {
      return
    }
    // Log the error to an error reporting service
    console.error("Projects error:", error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-amber-600" aria-hidden="true" />
          </div>
          <CardTitle className="text-xl">Unable to load this page</CardTitle>
          <CardDescription>
            There was a problem loading this section. Please try again or go back.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === "development" && (
            <div className="p-3 bg-gray-100 rounded-md">
              <p className="text-sm font-mono text-gray-700 break-all">
                {error.message || "Unknown error"}
              </p>
              {error.digest && (
                <p className="text-xs text-gray-500 mt-1">
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={reset}
              className="flex-1"
              aria-label="Try loading this page again"
            >
              <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/projects")}
              className="flex-1"
              aria-label="Go back to projects list"
            >
              <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
              Back to Projects
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
