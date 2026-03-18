import { LoadingState } from "@/components/shared/LoadingState"

export default function ClientDetailLoading() {
  return <LoadingState message="Loading client details..." variant="skeleton" />
}
