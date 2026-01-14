import { LoadingState } from "@/components/shared/LoadingState"

export default function LeadDetailLoading() {
  return <LoadingState message="Loading lead details..." variant="skeleton" />
}
