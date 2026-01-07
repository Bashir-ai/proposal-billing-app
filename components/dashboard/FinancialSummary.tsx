import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { TrendingUp, DollarSign, FileText, Clock } from "lucide-react"

interface FinancialSummaryProps {
  totalRevenue: number
  invoicedNotPaid: number
  closedProposalsNotCharged: number
  unbilledWork: {
    timesheetHours: number
    totalAmount: number
  }
  currency?: string
}

export function FinancialSummary({
  totalRevenue,
  invoicedNotPaid,
  closedProposalsNotCharged,
  unbilledWork,
  currency = "EUR",
}: FinancialSummaryProps) {
  const financialItems = [
    {
      label: "Total Revenue",
      value: formatCurrency(totalRevenue, currency),
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      label: "Invoiced but Not Paid",
      value: formatCurrency(invoicedNotPaid, currency),
      icon: DollarSign,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      label: "Closed Proposals Not Charged",
      value: formatCurrency(closedProposalsNotCharged, currency),
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Unbilled Project Work",
      value: formatCurrency(unbilledWork.totalAmount, currency),
      icon: Clock,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      subtitle: `${unbilledWork.timesheetHours.toFixed(1)} hours`,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {financialItems.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.label}
              className={`p-4 rounded-lg ${item.bgColor} border border-gray-200`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Icon className={`h-5 w-5 ${item.color}`} />
                  <span className="text-sm font-medium text-gray-700">{item.label}</span>
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className={`text-2xl font-bold ${item.color}`}>{item.value}</span>
                {item.subtitle && (
                  <span className="text-xs text-gray-500 ml-2">{item.subtitle}</span>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}





