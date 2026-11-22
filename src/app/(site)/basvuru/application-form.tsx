"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, Field, Input, SubmitButton, Textarea } from "@/components/ui/form";
import { ProvinceDistrictSelect, type LocationOption } from "@/components/map/province-district-select";
import { useFormAction } from "@/components/ui/use-action";
import { formatTL } from "@/lib/money";
import { cn } from "@/lib/cn";

type Plan = { id: string; name: string; description: string | null; monthly: number; yearly: number | null; highlights: string[]; isDefault: boolean };

export function ApplicationForm({
  action,
  plans,
  locations,
  freeMonths,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  plans: Plan[];
  locations: LocationOption[];
  freeMonths: number;
}) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  const [planId, setPlanId] = useState(plans.find((p) => p.isDefault)?.id ?? plans[0]?.id ?? "");
  const plan = plans.find((p) => p.id === planId);
  const [cycle, setCycle] = useState<"MONTHLY" | "YEARLY">(plan?.yearly != null ? "YEARLY" : "MONTHLY");
  const effCycle = plan?.yearly == null ? "MONTHLY" : cycle;

  if (state.status === "success") {
    return (
      <div className="space-y-4 rounded-3xl border border-stone-200/80 bg-white p-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-600" aria-hidden />
        <h2 className="text-2xl font-semibold tracking-tight text-stone-900">Başvurunuz alındı</h2>
        <p className="mx-auto max-w-md text-stone-600">
          Ekibimiz en kısa sürede sizi arayacak. Onaylandığında giriş bilgileriniz e-posta adresinize gönderilecek.
        </p>
        <Link href="/" className="inline-flex text-sm font-medium text-stone-900 underline underline-offset-4">
          Ana sayfaya dön
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}

      <fieldset className="space-y-4 rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-8">
        <legend className="px-1 text-lg font-semibold text-stone-900">1. Paketinizi seçin</legend>
        <div role="radiogroup" aria-label="Ödeme dönemi" className="inline-flex rounded-xl bg-stone-100 p-1 text-sm">
          {(["YEARLY", "MONTHLY"] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={effCycle === c}
              disabled={c === "YEARLY" && plan?.yearly == null}
              onClick={() => setCycle(c)}
              className={cn("rounded-lg px-4 py-1.5 disabled:opacity-40", effCycle === c ? "bg-white font-medium text-stone-900 shadow-sm" : "text-stone-600")}
            >
              {c === "YEARLY" ? "Yıllık (avantajlı)" : "Aylık"}
            </button>
          ))}
        </div>
        <input type="hidden" name="billingCycle" value={effCycle} />
        <div className={cn("grid gap-3", plans.length > 1 && "sm:grid-cols-2")}>
          {plans.map((p) => {
            const yearly = effCycle === "YEARLY" && p.yearly != null;
            const perDay = yearly ? p.yearly! / 365 : p.monthly / 30;
            return (
              <label
                key={p.id}
                className="flex cursor-pointer flex-col gap-3 rounded-2xl border-2 border-stone-200 p-5 has-[:checked]:border-brand-900 has-[:checked]:bg-brand-50"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <input type="radio" name="planId" value={p.id} checked={planId === p.id} onChange={() => setPlanId(p.id)} className="accent-brand-900" />
                    <span className="font-semibold text-stone-900">{p.name}</span>
                  </span>
                  <span className="rounded-full bg-accent-600 px-2.5 py-0.5 text-xs font-semibold text-white">{freeMonths} ay ücretsiz</span>
                </span>
                <span>
                  <span className="text-3xl font-bold tracking-tight text-stone-900">≈{formatTL(Math.round(perDay) * 100)}</span>
                  <span className="text-sm text-stone-600"> / gün</span>
                </span>
                <span className="text-sm text-stone-600">
                  Ücretsiz süreden sonra {yearly ? `yılda ${formatTL(p.yearly!)} (aylık ${formatTL(Math.round(p.yearly! / 12))}'ye denk)` : `ayda ${formatTL(p.monthly)}`}
                </span>
                {p.highlights.length > 0 && (
                  <ul className="list-inside list-disc text-sm text-stone-600">
                    {p.highlights.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                )}
              </label>
            );
          })}
        </div>
        {fe?.planId && <p className="text-sm text-red-600">{fe.planId}</p>}
        <p className="text-sm text-stone-500">Ücretsiz süre boyunca kart bilgisi istenmez, ödeme alınmaz. Randevu başına komisyon yoktur.</p>
      </fieldset>

      <fieldset className="space-y-4 rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-8">
        <legend className="px-1 text-lg font-semibold text-stone-900">2. İşletme bilgileri</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="İşletme adı" name="businessName" error={fe?.businessName} required>
            <Input id="businessName" name="businessName" maxLength={80} autoComplete="organization" />
          </Field>
          <Field label="Çalışan sayısı" name="staffCount" error={fe?.staffCount} required hint="Sizinle birlikte kaç usta çalışıyor?">
            <Input id="staffCount" name="staffCount" type="number" min={1} max={100} defaultValue={1} inputMode="numeric" />
          </Field>
        </div>
        <ProvinceDistrictSelect locations={locations} errors={fe} />
        <Field label="Açık adres" name="addressLine" error={fe?.addressLine} required>
          <Textarea id="addressLine" name="addressLine" rows={2} maxLength={300} autoComplete="street-address" />
        </Field>
      </fieldset>

      <fieldset className="space-y-4 rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-8">
        <legend className="px-1 text-lg font-semibold text-stone-900">3. İletişim</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ad soyad" name="ownerName" error={fe?.ownerName} required>
            <Input id="ownerName" name="ownerName" maxLength={80} autoComplete="name" />
          </Field>
          <Field label="Telefon" name="phone" error={fe?.phone} required>
            <Input id="phone" name="phone" type="tel" placeholder="0532 123 45 67" autoComplete="tel" />
          </Field>
        </div>
        <Field label="E-posta" name="email" error={fe?.email} required hint="Giriş bilgileriniz bu adrese gönderilir.">
          <Input id="email" name="email" type="email" autoCapitalize="none" autoComplete="email" />
        </Field>
        <Field label="Eklemek istedikleriniz" name="note" error={fe?.note}>
          <Textarea id="note" name="note" rows={2} maxLength={500} placeholder="Örn. bizi hangi saatlerde arayabilirsiniz?" />
        </Field>
        {/* Bot tuzağı: ekranda görünmez */}
        <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
          <label>
            Web sitesi <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <div className="space-y-1">
          <Checkbox
            name="kvkk"
            label={
              <span>
                <Link href="/kvkk-aydinlatma" target="_blank" className="underline underline-offset-4">
                  Aydınlatma metnini
                </Link>{" "}
                okudum; başvurum için benimle iletişime geçilmesini kabul ediyorum.
              </span>
            }
          />
          {fe?.kvkk && <p className="text-sm text-red-600">{fe.kvkk}</p>}
        </div>
      </fieldset>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-stone-500">Başvurunuzu inceleyip sizi arıyoruz. Kurulumu biz yapıyoruz.</p>
        <SubmitButton pending={pending} size="lg">
          Başvuruyu gönder
        </SubmitButton>
      </div>
    </form>
  );
}
