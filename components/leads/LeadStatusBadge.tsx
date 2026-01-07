import { LeadStatus } from "@prisma/client"

interface LeadStatusBadgeProps {
  status: LeadStatus
}

export function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
  const getStatusColor = (status: LeadStatus) => {
    switch (status) {
      case "NEW":
        return "bg-blue-100 text-blue-800"
      case "CONTACTED":
        return "bg-yellow-100 text-yellow-800"
      case "QUALIFIED":
        return "bg-purple-100 text-purple-800"
      case "PROPOSAL_SENT":
        return "bg-indigo-100 text-indigo-800"
      case "NEGOTIATING":
        return "bg-orange-100 text-orange-800"
      case "CONVERTED":
        return "bg-green-100 text-green-800"
      case "LOST":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <span
      className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(status)}`}
    >
      {status.replace("_", " ")}
    </span>
  )
}



