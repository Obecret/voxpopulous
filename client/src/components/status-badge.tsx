import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@shared/schema";

type StatusType = "idea" | "incident" | "meeting";

interface StatusBadgeProps {
  type: StatusType;
  status: string;
}

const statusColors: Record<string, string> = {
  NEW: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  UNDER_REVIEW: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  IN_PROGRESS: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  DONE: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  RESOLVED: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  REJECTED: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  ACKNOWLEDGED: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  SCHEDULED: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  COMPLETED: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  CANCELLED: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
};

export function StatusBadge({ type, status }: StatusBadgeProps) {
  const labels = STATUS_LABELS[type] as Record<string, string>;
  const label = labels[status] || status;
  const colorClass = statusColors[status] || "bg-gray-500/10 text-gray-600";

  return (
    <Badge variant="outline" className={`${colorClass} border`}>
      {label}
    </Badge>
  );
}
