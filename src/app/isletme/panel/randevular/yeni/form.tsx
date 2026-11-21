"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, UserPlus, X } from "lucide-react";
import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select, SubmitButton } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";
import { SlotPicker } from "@/components/panel/slot-picker";
import { formatTL } from "@/lib/money";
import { formatTrPhone } from "@/lib/phone";
import { cn } from "@/lib/cn";
import type { SlotResult } from "../actions";

type Svc = { id: string; name: string; durationMin: number; priceKurus: number; staffIds: string[] };
type Pkg = { id: string; name: string; durationMin: number; priceKurus: number; staffIds: string[] };
type Staff = { id: string; name: string };
type Found = { id: string; name: string; phone: string | null; hasAccount: boolean };

export function NewAppointmentForm({
  action,
  fetchSlots,
  search,
  services,
  packages,
  staff,
  today,
  defaultDate,
  defaultStaffId,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  fetchSlots: (i: { date: string; serviceIds: string[]; packageId?: string; staffId?: string | null }) => Promise<SlotResult>;
  search: (q: string) => Promise<Found[]>;
  services: Svc[];
  packages: Pkg[];
  staff: Staff[];
  today: string;
  defaultDate: string;
  defaultStaffId?: string;
}) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  const [mode, setMode] = useState<"services" | "package">("services");
  const [svcIds, setSvcIds] = useState<string[]>([]);
  const [pkgId, setPkgId] = useState("");
  const [staffId, setStaffId] = useState(defaultStaffId ?? "");
  const [customer, setCustomer] = useState<Found | null>(null);
  const [newCustomer, setNewCustomer] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [searching, startSearch] = useTransition();

  const eligible = useMemo(() => {
    if (mode === "package") return packages.find((p) => p.id === pkgId)?.staffIds ?? [];
    if (!svcIds.length) return staff.map((s) => s.id);
    return staff.map((s) => s.id).filter((sid) => svcIds.every((id) => services.find((x) => x.id === id)?.staffIds.includes(sid)));
  }, [mode, pkgId, svcIds, services, packages, staff]);
  const effectiveStaff = eligible.includes(staffId) ? staffId : "";

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-stone-900">Müşteri</h2>
        {customer ? (
          <div className="flex items-center justify-between rounded-2xl border border-stone-200 px-4 py-3 text-sm">
            <input type="hidden" name="businessCustomerId" value={customer.id} />
            <span>
              <span className="font-medium text-stone-900">{customer.name}</span>
              {customer.phone && <span className="text-stone-500"> · {formatTrPhone(customer.phone)}</span>}
              {customer.hasAccount && <span className="ml-2 text-xs text-accent-600">Üye</span>}
            </span>
            <button type="button" onClick={() => setCustomer(null)} className="rounded-lg p-1 text-stone-500 hover:bg-stone-100" aria-label="Müşteriyi kaldır">
              <X className="size-4" />
            </button>
          </div>
        ) : newCustomer ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ad soyad" name="guestName" error={fe?.guestName ?? fe?.name} required>
              <Input id="guestName" name="guestName" maxLength={80} autoFocus />
            </Field>
            <Field label="Telefon" name="guestPhone" error={fe?.guestPhone ?? fe?.phone} hint="İsteğe bağlı; aynı telefonla müşteri kaydı birleştirilir.">
              <Input id="guestPhone" name="guestPhone" type="tel" placeholder="0532 123 45 67" />
            </Field>
            <button type="button" onClick={() => setNewCustomer(false)} className="w-fit text-sm text-stone-500 hover:text-stone-900">
              Kayıtlı müşterilerde ara
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Müşteri ara</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-500" aria-hidden />
                <Input
                  value={q}
                  onChange={(e) => {
                    const v = e.target.value;
                    setQ(v);
                    if (v.trim().length >= 2) startSearch(async () => setFound(await search(v)));
                    else setFound([]);
                  }}
                  placeholder="Ad ya da telefonla ara"
                  className="pl-9"
                />
              </label>
              <button type="button" onClick={() => setNewCustomer(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 text-sm text-stone-700 hover:bg-stone-50">
                <UserPlus className="size-4" aria-hidden /> Yeni müşteri
              </button>
            </div>
            {fe?.guestName && <p className="text-sm text-red-600">{fe.guestName}</p>}
            {q.trim().length >= 2 && (
              <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200/80">
                {searching && <li className="px-4 py-2 text-sm text-stone-500">Aranıyor…</li>}
                {!searching && found.length === 0 && <li className="px-4 py-2 text-sm text-stone-500">Sonuç yok. “Yeni müşteri” ile ekleyebilirsiniz.</li>}
                {found.map((f) => (
                  <li key={f.id}>
                    <button type="button" onClick={() => setCustomer(f)} className="w-full px-4 py-2 text-left text-sm hover:bg-stone-50">
                      <span className="text-stone-900">{f.name}</span>
                      {f.phone && <span className="text-stone-500"> · {formatTrPhone(f.phone)}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-900">Hizmet</h2>
          {packages.length > 0 && (
            <div className="flex rounded-xl bg-stone-100 p-0.5 text-sm" role="tablist">
              {(["services", "package"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={cn("rounded-lg px-3 py-1", mode === m ? "bg-white text-stone-900 shadow-sm" : "text-stone-600")}
                >
                  {m === "services" ? "Hizmetler" : "Paket"}
                </button>
              ))}
            </div>
          )}
        </div>
        {mode === "services" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {services.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200/80 px-3 py-2.5 text-sm hover:bg-stone-50 has-[:checked]:border-stone-400">
                <input
                  type="checkbox"
                  name="serviceIds"
                  value={s.id}
                  checked={svcIds.includes(s.id)}
                  onChange={(e) => setSvcIds(e.target.checked ? [...svcIds, s.id] : svcIds.filter((x) => x !== s.id))}
                  className="size-4 accent-brand-900"
                />
                <span className="flex-1">
                  <span className="block text-stone-900">{s.name}</span>
                  <span className="text-xs text-stone-500">
                    {s.durationMin} dk · {formatTL(s.priceKurus)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <Select name="packageId" value={pkgId} onChange={(e) => setPkgId(e.target.value)} aria-label="Paket">
            <option value="">Paket seçin</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.durationMin} dk · {formatTL(p.priceKurus)}
              </option>
            ))}
          </Select>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-stone-900">Çalışan ve saat</h2>
        <Select name="staffId" value={effectiveStaff} onChange={(e) => setStaffId(e.target.value)} aria-label="Çalışan" className="max-w-xs">
          <option value="">Fark etmez (müsait olan)</option>
          {staff
            .filter((s) => eligible.includes(s.id))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </Select>
        <SlotPicker
          fetchSlots={fetchSlots}
          serviceIds={mode === "services" ? svcIds : []}
          packageId={mode === "package" && pkgId ? pkgId : undefined}
          staffId={effectiveStaff || null}
          defaultDate={defaultDate}
          minDate={today}
        />
        {fe?.time && <p className="text-sm text-red-600">{fe.time}</p>}
      </section>

      <Field label="İç not (müşteri görmez)" name="internalNote" error={fe?.internalNote}>
        <Input id="internalNote" name="internalNote" maxLength={500} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingText="Oluşturuluyor…">
          Randevuyu oluştur
        </SubmitButton>
      </div>
    </form>
  );
}
