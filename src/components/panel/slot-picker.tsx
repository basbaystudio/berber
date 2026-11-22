"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatTL } from "@/lib/money";
import type { SlotResult } from "@/app/isletme/panel/randevular/actions";

/**
 * Tarih seçilince seçime göre gerçek müsait saatleri sunucudan çeker. Seçilen saat `time`, tarih `date` alanıyla gönderilir.
 * Çalışan "fark etmez" ise seçilen slottaki ilk müsait çalışan önerilir (sunucu yine kendisi doğrular).
 */
export function SlotPicker({
  fetchSlots,
  serviceIds,
  packageId,
  staffId,
  defaultDate,
  minDate,
  ignoreAppointmentId,
  onStaffSuggest,
}: {
  fetchSlots: (i: { date: string; serviceIds: string[]; packageId?: string; staffId?: string | null; ignoreAppointmentId?: string }) => Promise<SlotResult>;
  serviceIds: string[];
  packageId?: string;
  staffId?: string | null;
  defaultDate: string;
  minDate: string;
  ignoreAppointmentId?: string;
  onStaffSuggest?: (staffIds: string[]) => void;
}) {
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [res, setRes] = useState<SlotResult | null>(null);
  const [pending, start] = useTransition();
  const hasSelection = serviceIds.length > 0 || !!packageId;

  useEffect(() => {
    setTime("");
    if (!hasSelection || !date) return setRes(null);
    start(async () => setRes(await fetchSlots({ date, serviceIds, packageId, staffId, ignoreAppointmentId })));
  }, [date, serviceIds.join(","), packageId, staffId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time} />
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-stone-700">Tarih</span>
        <input type="date" value={date} min={minDate} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm" aria-label="Randevu tarihi" />
      </label>
      {!hasSelection ? (
        <p className="text-sm text-stone-500">Saatleri görmek için önce hizmet ya da paket seçin.</p>
      ) : pending ? (
        <p className="flex items-center gap-2 text-sm text-stone-500">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Müsait saatler yükleniyor…
        </p>
      ) : res && "error" in res ? (
        <p className="text-sm text-red-600">{res.error}</p>
      ) : res ? (
        <>
          <p className="text-xs text-stone-500">
            Süre {res.durationMin} dk · {formatTL(res.totalKurus)}
          </p>
          {res.slots.length === 0 ? (
            <p className="text-sm text-stone-500">Bu tarihte müsait saat yok.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="Müsait saatler">
              {res.slots.map((s) => (
                <button
                  key={s.time}
                  type="button"
                  role="radio"
                  aria-checked={time === s.time}
                  onClick={() => {
                    setTime(s.time);
                    onStaffSuggest?.(s.staffIds);
                  }}
                  className={cn(
                    "h-9 rounded-xl border text-sm tabular-nums transition-colors",
                    time === s.time ? "border-brand-900 bg-brand-900 text-white" : "border-stone-200 bg-white text-stone-700 hover:border-stone-400",
                  )}
                >
                  {s.time}
                </button>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
