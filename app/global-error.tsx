"use client"

import { useEffect } from "react"

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Critical application error:", error)
  }, [error])

  return (
    <html>
      <body>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f9fafb",
          padding: "1rem",
          fontFamily: "system-ui, -apple-system, sans-serif"
        }}>
          <div style={{
            maxWidth: "28rem",
            width: "100%",
            backgroundColor: "white",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)",
            padding: "2rem",
            textAlign: "center"
          }}>
            <div style={{
              width: "4rem",
              height: "4rem",
              backgroundColor: "#fee2e2",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem"
            }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#dc2626"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </div>
            <h1 style={{
              fontSize: "1.25rem",
              fontWeight: "600",
              color: "#111827",
              marginBottom: "0.5rem"
            }}>
              Critical Error
            </h1>
            <p style={{
              color: "#6b7280",
              marginBottom: "1.5rem"
            }}>
              A critical error has occurred. Please refresh the page or contact support if the problem persists.
            </p>
            <button
              onClick={reset}
              style={{
                backgroundColor: "#2563eb",
                color: "white",
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                border: "none",
                cursor: "pointer",
                fontWeight: "500",
                width: "100%"
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}

