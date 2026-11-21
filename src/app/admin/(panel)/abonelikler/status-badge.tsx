import { Badge } from "@/components/ui/feedback";
import type { SubscriptionStatus } from "@/server/modules/billing/status";

export function SubscriptionBadge({ status }: { status: SubscriptionStatus }) {
  const tone = { FREE_PERIOD: "gray", TRIAL: "amber", PAID: "green", PAST_DUE: "red", CANCELLED: "gray" } as const;
  const extra =
    status.kind === "TRIAL" || status.kind === "PAID" ? ` · ${status.days} gün` : status.kind === "PAST_DUE" ? ` · ${status.days} gün` : "";
  return <Badge tone={tone[status.kind]}>{status.label + extra}</Badge>;
}
