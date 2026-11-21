import { Badge } from "@/components/ui/feedback";

export function StatusBadge({ status, published, reason }: { status: "DRAFT" | "ACTIVE" | "SUSPENDED"; published: boolean; reason?: string | null }) {
  return (
    <span className="flex flex-wrap gap-1">
      {status === "ACTIVE" && <Badge tone="green">Aktif</Badge>}
      {status === "DRAFT" && <Badge tone="amber">Taslak</Badge>}
      {status === "SUSPENDED" && <Badge tone="red">{reason === "BILLING" ? "Askıda (ödeme)" : "Askıda"}</Badge>}
      {published ? <Badge tone="blue">Yayında</Badge> : <Badge>Yayında değil</Badge>}
    </span>
  );
}
