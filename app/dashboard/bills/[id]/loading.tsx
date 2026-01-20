import { LoadingState } from "@/components/shared/LoadingState"

export default function BillDetailLoading() {
  return <LoadingState message="Loading invoice details..." variant="skeleton" />
}
