"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function CreateTestUsersPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const createUsers = async () => {
    setLoading(true)
    setResult(null)
    try {
      const response = await fetch("/api/admin/create-dummy-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Create Test Users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            This will create three test users (MAT, SDF, VHP) with STAFF role for testing purposes.
            Users that already exist will be skipped.
          </p>
          
          <Button onClick={createUsers} disabled={loading}>
            {loading ? "Creating..." : "Create Test Users"}
          </Button>

          {result && (
            <div className={`p-4 rounded ${result.error ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
              {result.error ? (
                <div>
                  <p className="font-semibold text-red-700">Error:</p>
                  <p className="text-red-600">{result.error}</p>
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-green-700 mb-2">{result.message}</p>
                  {result.created && result.created.length > 0 && (
                    <div className="mb-2">
                      <p className="text-sm font-semibold text-green-700">Created:</p>
                      <ul className="list-disc list-inside text-sm text-green-600">
                        {result.created.map((user: any) => (
                          <li key={user.id}>
                            {user.name} ({user.email})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.skipped && result.skipped.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-yellow-700">Skipped:</p>
                      <ul className="list-disc list-inside text-sm text-yellow-600">
                        {result.skipped.map((user: any) => (
                          <li key={user.email}>
                            {user.name} ({user.email}) - {user.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 p-4 bg-gray-50 rounded">
            <p className="text-sm font-semibold mb-2">Test User Credentials:</p>
            <ul className="text-sm space-y-1">
              <li><strong>MAT:</strong> mat@test.com / test123 (€150/hr)</li>
              <li><strong>SDF:</strong> sdf@test.com / test123 (€175/hr)</li>
              <li><strong>VHP:</strong> vhp@test.com / test123 (€200/hr)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}







