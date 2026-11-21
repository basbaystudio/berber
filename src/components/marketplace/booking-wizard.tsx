"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { formatTL } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { PublicSlots } from "@/app/(site)/berber/actions";

type Svc = { id: string; name: string; durationMin: number; priceKurus: number; staffIds: string[] };
type Pkg = { id: string; name: string; durationMin: number; priceKurus: number; items: string[]; staffIds: string[] };
type Staff = { id: string; name: string; title: string | null; photoUrl: string | null };

const dayLabel = (d: string) => new Intl.DateTimeFormat("tr-TR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/**
 * Online randevu sihirbazı. Bütün seçimler adres çubuğunda tutulur (h, p, c, t, s);
 * misafir kullanıcı giriş yapıp geri döndüğünde seçimler aynen korunur.
 */
export function BookingWizard({
  slug,
  services,
  packages,
  staff,
  initial,
  today,
  maxDays,
  auth,
  fetchSlots,
  book,
  resend,
}: {
  slug: string;
  services: Svc[];
  packages: Pkg[];
  staff: Staff[];
  initial: { h: string[]; p?: string; c?: string; t?: string; s?: string };
  today: string;
  maxDays: number;
  auth: "guest" | "unverified" | "ok";
  fetchSlots: (i: { date: string; serviceIds: string[]; packageId?: string; staffId?: string | null }) => Promise<PublicSlots>;
  book: (i: { date: string; time: string; serviceIds: string[]; packageId?: string; staffId?: string | null; note?: string; idempotencyKey: string }) => Promise<ActionState<{ id: string }>>;
  resend: () => Promise<ActionState>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [svcIds, setSvcIds] = useState<string[]>(initial.h.filter((id) => services.some((s) => s.id === id)));
  const [pkgId, setPkgId] = useState<string | undefined>(packages.some((p) => p.id === initial.p) ? initial.p : undefined);
  const [staffId, setStaffId] = useState<string>(initial.c ?? "");
  const [date, setDate] = useState<string>(initial.t && initial.t >= today ? initial.t : today);
  const [time, setTime] = useState<string>(initial.s ?? "");
  const [note, setNote] = useState("");
  const [slots, setSlots] = useState<PublicSlots | null>(null);
  const [loading, setLoading] = useState(false);
  const idem = useRef<string>("");
  if (!idem.current) idem.current = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

  const hasSel = svcIds.length > 0 || !!pkgId;
  const eligible = useMemo(() => {
    if (pkgId) return packages.find((p) => p.id === pkgId)?.staffIds ?? [];
    if (!svcIds.length) return staff.map((s) => s.id);
    return staff.map((s) => s.id).filter((sid) => svcIds.every((id) => services.find((x) => x.id === id)?.staffIds.includes(sid)));
  }, [pkgId, svcIds, services, packages, staff]);
  const effStaff = eligible.includes(staffId) ? staffId : "";

  // Seçimleri adres çubuğuna yaz (giriş sonrası korunur)
  const qs = useMemo(() => {
    const u = new URLSearchParams();
    if (pkgId) u.set("p", pkgId);
    else if (svcIds.length) u.set("h", svcIds.join(","));
    if (effStaff) u.set("c", effStaff);
    if (date) u.set("t", date);
    if (time) u.set("s", time);
    return u.toString();
  }, [pkgId, svcIds, effStaff, date, time]);
  useEffect(() => {
    router.replace(`${pathname}?${qs}`, { scroll: false });
  }, [qs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Saatleri getir
  const firstLoad = useRef(true);
  useEffect(() => {
    if (!firstLoad.current) setTime("");
    firstLoad.current = false;
    if (!hasSel) return setSlots(null);
    let cancelled = false;
    setLoading(true);
    fetchSlots({ date, serviceIds: pkgId ? [] : svcIds, packageId: pkgId, staffId: effStaff || null }).then((r) => {
      if (!cancelled) {
        setSlots(r);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [date, svcIds.join(","), pkgId, effStaff]); // eslint-disable-line react-hooks/exhaustive-deps

  const slotOk = slots && !("error" in slots) && slots.slots.some((s) => s.time === time);
  const [result, submit, submitting] = useActionState(
    async () => book({ date, time, serviceIds: pkgId ? [] : svcIds, packageId: pkgId, staffId: effStaff || null, note: note || undefined, idempotencyKey: idem.current }),
    { status: "idle" } as ActionState<{ id: string }>,
  );
  const [resendState, doResend, resending] = useActionState(async () => resend(), { status: "idle" } as ActionState);
  const total = slots && !("error" in slots) ? slots : null;
  const days = Array.from({ length: Math.min(14, maxDays + 1) }, (_, i) => addDays(today, i));
  const step = "rounded-3xl border border-stone-200/80 bg-white p-5 sm:p-6";
  const stepTitle = (n: number, t: string, done: boolean) => (
    <h2 className="mb-4 flex items-center gap-3 font-semibold text-stone-900">
      <span className={cn("grid size-7 place-items-center rounded-full text-sm", done ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-500")}>{done ? <Check className="size-4" /> : n}</span>
      {t}
    </h2>
  );

  return (
    <div className="space-y-4">
      <section className={step}>
        {stepTitle(1, "Hizmet seçin", hasSel)}
        <div className="grid gap-2 sm:grid-cols-2">
          {services.map((s) => {
            const on = !pkgId && svcIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setPkgId(undefined);
                  setSvcIds(on ? svcIds.filter((x) => x !== s.id) : [...svcIds, s.id]);
                }}
                className={cn("flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-colors", on ? "border-stone-900 bg-stone-50" : "border-stone-200 hover:border-stone-400")}
              >
                <span>
                  <span className="block font-medium text-stone-900">{s.name}</span>
                  <span className="text-stone-500">{s.durationMin} dk</span>
                </span>
                <span className="tabular-nums text-stone-800">{formatTL(s.priceKurus)}</span>
              </button>
            );
          })}
        </div>
        {packages.length > 0 && (
          <>
            <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-stone-400">Paketler</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {packages.map((p) => {
                const on = pkgId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setSvcIds([]);
                      setPkgId(on ? undefined : p.id);
                    }}
                    className={cn("flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm", on ? "border-stone-900 bg-stone-50" : "border-stone-200 hover:border-stone-400")}
                  >
                    <span>
                      <span className="block font-medium text-stone-900">{p.name}</span>
                      <span className="text-stone-500">
                        {p.items.join(" + ")} · {p.durationMin} dk
                      </span>
                    </span>
                    <span className="tabular-nums text-stone-800">{formatTL(p.priceKurus)}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className={cn(step, !hasSel && "opacity-50")}>
        {stepTitle(2, "Çalışan", hasSel)}
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Çalışan">
          <button type="button" role="radio" aria-checked={!effStaff} disabled={!hasSel} onClick={() => setStaffId("")} className={cn("rounded-full border px-4 py-2 text-sm", !effStaff ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 text-stone-700")}>
            Fark etmez
          </button>
          {staff
            .filter((s) => eligible.includes(s.id))
            .map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={effStaff === s.id}
                disabled={!hasSel}
                onClick={() => setStaffId(s.id)}
                className={cn("rounded-full border px-4 py-2 text-sm", effStaff === s.id ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 text-stone-700 hover:border-stone-400")}
              >
                {s.name}
              </button>
            ))}
        </div>
        {hasSel && eligible.length === 0 && <p className="mt-3 text-sm text-red-600">Bu seçim için müsait çalışan yok. Farklı bir hizmet deneyin.</p>}
      </section>

      <section className={cn(step, !hasSel && "opacity-50")}>
        {stepTitle(3, "Tarih ve saat", !!slotOk)}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="radiogroup" aria-label="Tarih">
          {days.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={date === d}
              disabled={!hasSel}
              onClick={() => setDate(d)}
              className={cn("shrink-0 rounded-2xl border px-3 py-2 text-center text-sm", date === d ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 text-stone-700 hover:border-stone-400")}
            >
              {d === today ? "Bugün" : dayLabel(d)}
            </button>
          ))}
        </div>
        <div className="mt-3">
          {!hasSel ? (
            <p className="text-sm text-stone-500">Saatleri görmek için önce hizmet seçin.</p>
          ) : loading ? (
            <p className="flex items-center gap-2 text-sm text-stone-500">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Boş saatler getiriliyor…
            </p>
          ) : slots && "error" in slots ? (
            <p className="text-sm text-red-600">{slots.error}</p>
          ) : slots && slots.slots.length === 0 ? (
            <p className="text-sm text-stone-500">Bu tarihte boş saat yok. Başka bir gün deneyin.</p>
          ) : slots ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="Boş saatler">
              {slots.slots.map((s) => (
                <button
                  key={s.time}
                  type="button"
                  role="radio"
                  aria-checked={time === s.time}
                  onClick={() => setTime(s.time)}
                  className={cn("h-10 rounded-xl border text-sm tabular-nums", time === s.time ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 text-stone-700 hover:border-stone-400")}
                >
                  {s.time}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className={cn(step, !slotOk && "opacity-50")}>
        {stepTitle(4, "Onay", false)}
        {total && slotOk ? (
          <dl className="mb-4 grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
            <dt className="text-stone-500">Hizmet</dt>
            <dd className="text-stone-900">{pkgId ? packages.find((p) => p.id === pkgId)?.name : svcIds.map((id) => services.find((s) => s.id === id)?.name).join(" + ")}</dd>
            <dt className="text-stone-500">Zaman</dt>
            <dd className="text-stone-900">
              {dayLabel(date)} · {time} ({total.durationMin} dk)
            </dd>
            <dt className="text-stone-500">Çalışan</dt>
            <dd className="text-stone-900">{effStaff ? staff.find((s) => s.id === effStaff)?.name : "Müsait olan"}</dd>
            <dt className="text-stone-500">Tutar</dt>
            <dd className="font-medium text-stone-900">{formatTL(total.totalKurus)} · işletmede ödenir</dd>
          </dl>
        ) : (
          <p className="mb-4 text-sm text-stone-500">Hizmet, tarih ve saat seçtiğinizde özet burada görünür.</p>
        )}
        {auth === "guest" ? (
          <div className="space-y-2">
            <p className="text-sm text-stone-600">Randevu almak için giriş yapmanız gerekiyor. Seçimleriniz korunacak.</p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/giris?next=${encodeURIComponent(`${pathname}?${qs}`)}`} className={cn("inline-flex h-11 items-center rounded-xl bg-stone-900 px-5 text-sm font-medium text-white hover:bg-stone-800", !slotOk && "pointer-events-none opacity-40")} aria-disabled={!slotOk}>
                Giriş yap ve onayla
              </Link>
              <Link href={`/kayit?next=${encodeURIComponent(`${pathname}?${qs}`)}`} className={cn("inline-flex h-11 items-center rounded-xl border border-stone-200 px-5 text-sm text-stone-800 hover:bg-stone-50", !slotOk && "pointer-events-none opacity-40")} aria-disabled={!slotOk}>
                Kayıt ol
              </Link>
            </div>
          </div>
        ) : auth === "unverified" ? (
          <div className="space-y-2">
            <Alert tone="warning">Randevu alabilmek için e-posta adresinizi doğrulayın. Size gönderdiğimiz bağlantıya tıklayın; ardından bu sayfayı yenileyin.</Alert>
            <Button variant="outline" disabled={resending} onClick={() => startTransition(() => doResend())}>
              Doğrulama e-postasını yeniden gönder
            </Button>
            {resendState.status === "success" && <p className="text-sm text-emerald-700">{resendState.message}</p>}
            {resendState.status === "error" && <p className="text-sm text-red-600">{resendState.message}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span className="text-stone-600">İşletmeye not (isteğe bağlı)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className="h-10 w-full rounded-xl border border-stone-200 px-3" />
            </label>
            {result.status === "error" && <Alert tone="error">{result.message}</Alert>}
            <Button size="lg" disabled={!slotOk || submitting} onClick={() => startTransition(() => submit())}>
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {submitting ? "Gönderiliyor…" : "Randevu talebini gönder"}
            </Button>
            <p className="text-xs text-stone-500">İşletme talebinizi onayladığında e-posta ile bilgilendirilirsiniz. Randevuya 2 saat kalana kadar iptal edebilirsiniz.</p>
          </div>
        )}
      </section>
      <p className="sr-only" aria-live="polite">
        {slug}
      </p>
    </div>
  );
}
