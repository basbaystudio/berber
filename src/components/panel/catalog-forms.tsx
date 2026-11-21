"use client";

import { useMemo, useState } from "react";
import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";
import { formatTL, kurusToInput } from "@/lib/money";

type Action = (p: ActionState, fd: FormData) => Promise<ActionState>;
type StaffOpt = { id: string; name: string; isActive: boolean; serviceIds: string[] };
type ServiceOpt = { id: string; name: string; durationMin: number; priceKurus: number; isActive: boolean };

function Result({ state }: { state: ActionState }) {
  if (state.status === "error") return <Alert tone="error">{state.message}</Alert>;
  if (state.status === "success" && state.message) return <Alert tone="success">{state.message}</Alert>;
  return null;
}

function CheckList({
  name,
  items,
  selected,
  onChange,
  disabledIds = [],
  empty,
}: {
  name: string;
  items: { id: string; label: string; sub?: string }[];
  selected: string[];
  onChange?: (ids: string[]) => void;
  disabledIds?: string[];
  empty: string;
}) {
  const [sel, setSel] = useState(selected);
  if (!items.length) return <p className="text-sm text-stone-500">{empty}</p>;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((it) => {
        const disabled = disabledIds.includes(it.id) && !sel.includes(it.id);
        return (
          <label
            key={it.id}
            className={`flex items-center gap-3 rounded-xl border border-stone-200/80 px-3 py-2.5 text-sm has-[:checked]:border-stone-400 ${disabled ? "opacity-50" : "cursor-pointer hover:bg-stone-50"}`}
          >
            <input
              type="checkbox"
              name={name}
              value={it.id}
              checked={sel.includes(it.id)}
              disabled={disabled}
              onChange={(e) => {
                const next = e.target.checked ? [...sel, it.id] : sel.filter((x) => x !== it.id);
                setSel(next);
                onChange?.(next);
              }}
              className="size-4 accent-brand-900"
            />
            <span>
              <span className="block text-stone-900">{it.label}</span>
              {it.sub && <span className="text-xs text-stone-500">{it.sub}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export type ServiceDefaults = {
  name: string;
  description: string | null;
  serviceTypeId: string | null;
  priceKurus: number;
  durationMin: number;
  isActive: boolean;
  staffIds: string[];
};

export function ServiceForm({
  action,
  types,
  staff,
  defaults,
}: {
  action: Action;
  types: { id: string; name: string }[];
  staff: StaffOpt[];
  defaults?: ServiceDefaults;
}) {
  const isNew = !defaults;
  const { state, pending, onSubmit, fieldErrors: fe, version } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" key={isNew ? version : "edit"}>
      <Result state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Hizmet adı" name="name" error={fe?.name} required>
          <Input id="name" name="name" defaultValue={defaults?.name} maxLength={80} placeholder="Örn. Saç kesimi" />
        </Field>
        <Field label="Hizmet türü" name="serviceTypeId" error={fe?.serviceTypeId} hint="Pazaryerindeki filtrelerde kullanılır.">
          <Select id="serviceTypeId" name="serviceTypeId" defaultValue={defaults?.serviceTypeId ?? ""}>
            <option value="">Seçin (önerilir)</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fiyat (TL)" name="priceKurus" error={fe?.priceKurus} required>
          <Input id="priceKurus" name="priceKurus" inputMode="decimal" defaultValue={kurusToInput(defaults?.priceKurus)} placeholder="450" />
        </Field>
        <Field label="Süre (dakika)" name="durationMin" error={fe?.durationMin} required>
          <Input id="durationMin" name="durationMin" type="number" min={5} max={600} step={5} defaultValue={defaults?.durationMin ?? 30} />
        </Field>
      </div>
      <Field label="Açıklama" name="description" error={fe?.description}>
        <Textarea id="description" name="description" rows={2} maxLength={500} defaultValue={defaults?.description ?? ""} />
      </Field>
      <Field label="Bu hizmeti verebilecek çalışanlar" name="staffIds" group error={fe?.staffIds}>
        <CheckList
          name="staffIds"
          items={staff.map((s) => ({ id: s.id, label: s.name, sub: s.isActive ? undefined : "Pasif" }))}
          selected={defaults?.staffIds ?? []}
          empty="Henüz çalışan yok. Çalışanları daha sonra da atayabilirsiniz."
        />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Checkbox name="isActive" defaultChecked={defaults?.isActive ?? true} label="Aktif (müşterilere gösterilir)" />
        <SubmitButton pending={pending}>{isNew ? "Hizmet ekle" : "Kaydet"}</SubmitButton>
      </div>
    </form>
  );
}

export type PackageDefaults = {
  name: string;
  description: string | null;
  priceKurus: number;
  durationMin: number;
  isActive: boolean;
  serviceIds: string[];
  staffIds: string[];
};

export function PackageForm({ action, services, staff, defaults }: { action: Action; services: ServiceOpt[]; staff: StaffOpt[]; defaults?: PackageDefaults }) {
  const isNew = !defaults;
  const { state, pending, onSubmit, fieldErrors, version } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Result state={state} />
      <PackageFields key={isNew ? version : "edit"} services={services} staff={staff} defaults={defaults} fe={fieldErrors} />
      <div className="flex justify-end">
        <SubmitButton pending={pending}>{isNew ? "Paket ekle" : "Kaydet"}</SubmitButton>
      </div>
    </form>
  );
}

function PackageFields({ services, staff, defaults, fe }: { services: ServiceOpt[]; staff: StaffOpt[]; defaults?: PackageDefaults; fe?: Record<string, string> }) {
  const [svcIds, setSvcIds] = useState<string[]>(defaults?.serviceIds ?? []);
  const chosen = services.filter((s) => svcIds.includes(s.id));
  const sumDuration = chosen.reduce((a, s) => a + s.durationMin, 0);
  const sumPrice = chosen.reduce((a, s) => a + s.priceKurus, 0);
  // Paketteki tüm hizmetleri verebilen çalışanlar seçilebilir
  const incapable = useMemo(() => staff.filter((st) => !svcIds.every((id) => st.serviceIds.includes(id))).map((st) => st.id), [staff, svcIds]);

  return (
    <>
      <Field label="Paketteki hizmetler" name="serviceIds" group error={fe?.serviceIds} hint="En az 2 hizmet seçin.">
        <CheckList
          name="serviceIds"
          items={services.map((s) => ({ id: s.id, label: s.name, sub: `${s.durationMin} dk · ${formatTL(s.priceKurus)}` }))}
          selected={svcIds}
          onChange={setSvcIds}
          empty="Önce hizmet ekleyin."
        />
      </Field>
      {chosen.length > 0 && (
        <p className="text-sm text-stone-500">
          Hizmetlerin toplamı: {sumDuration} dk · {formatTL(sumPrice)}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Paket adı" name="name" id="pname" error={fe?.name} required>
          <Input id="pname" name="name" defaultValue={defaults?.name} maxLength={80} placeholder="Örn. Damat paketi" />
        </Field>
        <Field label="Paket fiyatı (TL)" name="priceKurus" id="ppriceKurus" error={fe?.priceKurus} required>
          <Input id="ppriceKurus" name="priceKurus" inputMode="decimal" defaultValue={kurusToInput(defaults?.priceKurus)} />
        </Field>
        <Field label="Toplam süre (dk)" name="durationMin" id="pdurationMin" error={fe?.durationMin} hint="Boşsa hizmetlerin toplamı">
          <Input id="pdurationMin" name="durationMin" type="number" min={5} max={600} step={5} defaultValue={defaults?.durationMin} placeholder={sumDuration ? String(sumDuration) : ""} />
        </Field>
      </div>
      <Field label="Açıklama" name="description" id="pdescription" error={fe?.description}>
        <Textarea id="pdescription" name="description" rows={2} maxLength={500} defaultValue={defaults?.description ?? ""} />
      </Field>
      <Field label="Paketi verebilecek çalışanlar" name="staffIds" group error={fe?.staffIds} hint="Paketin tamamını tek çalışan yapar; yalnızca tüm hizmetleri verebilen çalışanlar seçilebilir.">
        <CheckList
          key={svcIds.join(",")}
          name="staffIds"
          items={staff.map((s) => ({ id: s.id, label: s.name, sub: incapable.includes(s.id) ? "Tüm hizmetleri vermiyor" : undefined }))}
          selected={(defaults?.staffIds ?? []).filter((id) => !incapable.includes(id))}
          disabledIds={incapable}
          empty="Henüz çalışan yok."
        />
      </Field>
      <Checkbox name="isActive" defaultChecked={defaults?.isActive ?? true} label="Aktif" />
    </>
  );
}
