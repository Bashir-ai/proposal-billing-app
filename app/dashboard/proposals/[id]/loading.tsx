import { LoadingState } from "@/components/shared/LoadingState"

export default function ProposalDetailLoading() {
  return <LoadingState message="Loading proposal details..." variant="skeleton" />
}
