"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Edit, Archive, Trash2 } from "lucide-react"
import { LeadStatusBadge } from "@/components/leads/LeadStatusBadge"
import { LeadInteractionTimeline } from "@/components/leads/LeadInteractionTimeline"
import { QuickInteractionButton } from "@/components/leads/QuickInteractionButton"
import { ConvertLeadDialog } from "@/components/leads/ConvertLeadDialog"
import { InteractionType, LeadStatus } from "@prisma/client"

interface LeadDetailClientProps {
  lead: any
  session: any
}

export function LeadDetailClient({ lead, session }: LeadDetailClientProps) {
  const router = useRouter()
  const [showConvertDialog, setShowConvertDialog] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleArchive = async () => {
    if (!confirm(`Are you sure you want to ${lead.archivedAt ? "unarchive" : "archive"} this lead?`)) {
      return
    }

    try {
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: lead.archivedAt ? "unarchive" : "archive",
        }),
      })

      if (response.ok) {
        router.refresh()
      }
    } catch (err) {
      console.error("Error archiving lead:", err)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this lead? This action cannot be undone.")) {
      return
    }

    try {
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        router.push("/dashboard/leads")
      }
    } catch (err) {
      console.error("Error deleting lead:", err)
    }
  }

  const handleInteractionCreated = () => {
    setRefreshKey((prev) => prev + 1)
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{lead.name}</h1>
          <div className="flex items-center space-x-4 mt-2">
            <LeadStatusBadge status={lead.status} />
            {lead.archivedAt && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                Archived
              </span>
            )}
            {lead.convertedToClient && (
              <Link
                href={`/dashboard/clients/${lead.convertedToClient.id}`}
                className="text-blue-600 hover:underline text-sm"
              >
                Converted to Client: {lead.convertedToClient.name}
              </Link>
            )}
          </div>
        </div>
        <div className="flex space-x-2">
          <Link href={`/dashboard/leads/${lead.id}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          {(session.user.role === "ADMIN" || session.user.role === "MANAGER") && (
            <Button variant="outline" onClick={handleArchive}>
              <Archive className="h-4 w-4 mr-2" />
              {lead.archivedAt ? "Unarchive" : "Archive"}
            </Button>
          )}
          {session.user.role === "ADMIN" && (
            <Button variant="outline" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          {!lead.convertedToClient && lead.status !== LeadStatus.CONVERTED && (
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <QuickInteractionButton
                    leadId={lead.id}
                    interactionType={InteractionType.EMAIL_SENT}
                    label="Email Sent"
                    onInteractionCreated={handleInteractionCreated}
                  />
                  <QuickInteractionButton
                    leadId={lead.id}
                    interactionType={InteractionType.MEETING}
                    label="Meeting"
                    onInteractionCreated={handleInteractionCreated}
                  />
                  <QuickInteractionButton
                    leadId={lead.id}
                    interactionType={InteractionType.PHONE_CALL}
                    label="Phone Call"
                    onInteractionCreated={handleInteractionCreated}
                  />
                  <QuickInteractionButton
                    leadId={lead.id}
                    interactionType={InteractionType.VISIT}
                    label="Visit"
                    onInteractionCreated={handleInteractionCreated}
                  />
                  <QuickInteractionButton
                    leadId={lead.id}
                    interactionType={InteractionType.PROPOSAL_SENT}
                    label="Proposal Sent"
                    onInteractionCreated={handleInteractionCreated}
                  />
                  <QuickInteractionButton
                    leadId={lead.id}
                    interactionType={InteractionType.QUESTIONNAIRE_SENT}
                    label="Questionnaire Sent"
                    onInteractionCreated={handleInteractionCreated}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Interaction Timeline */}
          <LeadInteractionTimeline
            key={refreshKey}
            interactions={lead.interactions}
          />

          {/* Related Todos */}
          {lead.todos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Related Todos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {lead.todos.map((todo: any) => (
                    <Link
                      key={todo.id}
                      href={`/dashboard/todos`}
                      className="block p-3 border rounded hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{todo.title}</span>
                        <span className="text-sm text-gray-500">
                          {todo.assignee.name}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Related Proposals */}
          {lead.proposals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Related Proposals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {lead.proposals.map((proposal: any) => (
                    <Link
                      key={proposal.id}
                      href={`/dashboard/proposals/${proposal.id}`}
                      className="block p-3 border rounded hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{proposal.title}</span>
                        {proposal.client && (
                          <span className="text-sm text-gray-500">
                            Client: {proposal.client.name}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Lead Information */}
          <Card>
            <CardHeader>
              <CardTitle>Lead Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Email</p>
                <p className="mt-1">{lead.email || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Phone</p>
                <p className="mt-1">{lead.phone || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Company</p>
                <p className="mt-1">{lead.company || "-"}</p>
              </div>
              {lead.contactInfo && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Contact Info</p>
                  <p className="mt-1">{lead.contactInfo}</p>
                </div>
              )}
              {lead.addressLine && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Address</p>
                  <p className="mt-1">
                    {lead.addressLine}
                    {lead.city && `, ${lead.city}`}
                    {lead.state && `, ${lead.state}`}
                    {lead.zipCode && ` ${lead.zipCode}`}
                    {lead.country && `, ${lead.country}`}
                  </p>
                </div>
              )}
              {lead.areaOfLaw && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Area of Law</p>
                  <p className="mt-1">{lead.areaOfLaw.name}</p>
                </div>
              )}
              {lead.sectorOfActivity && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Sector of Activity</p>
                  <p className="mt-1">{lead.sectorOfActivity.name}</p>
                </div>
              )}
              {lead.leadManager && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Lead Manager</p>
                  <p className="mt-1">{lead.leadManager.name}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-600">Created By</p>
                <p className="mt-1">{lead.creator.name}</p>
              </div>
            </CardContent>
          </Card>

          {/* Convert to Client */}
          {!lead.convertedToClient && lead.status !== LeadStatus.CONVERTED && (
            <Card>
              <CardHeader>
                <CardTitle>Convert to Client</CardTitle>
              </CardHeader>
              <CardContent>
                {showConvertDialog ? (
                  <ConvertLeadDialog
                    leadId={lead.id}
                    leadName={lead.name}
                    onClose={() => setShowConvertDialog(false)}
                  />
                ) : (
                  <Button
                    onClick={() => setShowConvertDialog(true)}
                    className="w-full"
                  >
                    Convert to Client
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}




