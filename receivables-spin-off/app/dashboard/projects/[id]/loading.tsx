import { LoadingState } from "@/components/shared/LoadingState"

export default function ProjectDetailLoading() {
  return <LoadingState message="Loading project details..." variant="skeleton" />
}
