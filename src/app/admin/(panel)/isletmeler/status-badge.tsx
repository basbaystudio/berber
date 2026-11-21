import { Badge } from "@/components/ui/feedback";

export function StatusBadge({ status, published }: { status: "DRAFT" | "ACTIVE" | "SUSPENDED"; published: boolean }) {
  return (
    <span className="flex flex-wrap gap-1">
      {status === "ACTIVE" && <Badge tone="green">Aktif</Badge>}
      {status === "DRAFT" && <Badge tone="amber">Taslak</Badge>}
      {status === "SUSPENDED" && <Badge tone="red">Askıda</Badge>}
      {published ? <Badge tone="blue">Yayında</Badge> : <Badge>Yayında değil</Badge>}
    </span>
  );
}
