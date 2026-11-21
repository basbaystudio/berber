import { Badge } from "@/components/ui/feedback";

export const STATUS_LABEL = {
  PENDING: "Onay bekliyor",
  CONFIRMED: "Onaylandı",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal edildi",
  NO_SHOW: "Gelmedi",
} as const;

const TONE = { PENDING: "amber", CONFIRMED: "blue", COMPLETED: "green", CANCELLED: "gray", NO_SHOW: "red" } as const;

export const CANCEL_REASON = {
  CUSTOMER: "Müşteri iptal etti",
  BUSINESS: "İşletme iptal etti",
  NOT_CONFIRMED_IN_TIME: "Süresi içinde onaylanmadı",
  ADMIN: "Yönetim iptal etti",
} as const;

export function AppointmentStatusBadge({ status }: { status: keyof typeof STATUS_LABEL }) {
  return <Badge tone={TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
