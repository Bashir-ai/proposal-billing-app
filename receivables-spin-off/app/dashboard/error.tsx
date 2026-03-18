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

export default function DashboardError({ error, reset }: ErrorProps) {
  const router = useRouter()

  useEffect(() => {
    // Don't log Next.js redirect errors - they're expected behavior
    if (error.digest && error.digest.startsWith('NEXT_REDIRECT')) {
      return
    }
    // Log the error to an error reporting service
    console.error("Dashboard error:", error)
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
          {/* Always show error details for debugging */}
          <div className="p-3 bg-gray-100 rounded-md">
            <p className="text-sm font-semibold text-gray-700 mb-2">Error Details:</p>
            <p className="text-sm font-mono text-gray-700 break-all">
              {error.message || "Unknown error"}
            </p>
            {error.digest && (
              <p className="text-xs text-gray-500 mt-1">
                Error ID: {error.digest}
              </p>
            )}
            {error.stack && (
              <details className="mt-2">
                <summary className="text-xs text-gray-500 cursor-pointer">Stack Trace</summary>
                <pre className="text-xs text-gray-600 mt-2 overflow-auto max-h-40">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
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
              onClick={() => router.back()}
              className="flex-1"
              aria-label="Go back to previous page"
            >
              <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


