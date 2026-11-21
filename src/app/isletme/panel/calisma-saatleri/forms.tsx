"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { ActionState } from "@/server/lib/action";
import type { TimeRange, WeeklyRanges } from "@/lib/schedule";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select, SubmitButton } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";
import { WeeklyEditor } from "@/components/panel/weekly-editor";

type Action = (p: ActionState, fd: FormData) => Promise<ActionState>;

function Result({ state }: { state: ActionState }) {
  if (state.status === "error") return <Alert tone="error">{state.message}</Alert>;
  if (state.status === "success" && state.message) return <Alert tone="success">{state.message}</Alert>;
  return null;
}

export function HoursForm({ action, defaultValue }: { action: Action; defaultValue: WeeklyRanges }) {
  const { state, pending, onSubmit } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Result state={state} />
      <WeeklyEditor name="weekly" defaultValue={defaultValue} />
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Çalışma saatlerini kaydet</SubmitButton>
      </div>
    </form>
  );
}

/** Tek gün için aralık listesi (özel çalışma saati). */
export function DayRangesInput({ name, defaultValue = [{ start: "10:00", end: "16:00" }] }: { name: string; defaultValue?: TimeRange[] }) {
  const [ranges, setRanges] = useState<TimeRange[]>(defaultValue);
  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(ranges)} />
      {ranges.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="time" step={300} value={r.start} aria-label={`${i + 1}. aralık başlangıç`} onChange={(e) => setRanges(ranges.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} className="h-9 w-28 rounded-xl border border-stone-200 px-2 text-sm" />
          <span className="text-stone-500">–</span>
          <input type="time" step={300} value={r.end} aria-label={`${i + 1}. aralık bitiş`} onChange={(e) => setRanges(ranges.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} className="h-9 w-28 rounded-xl border border-stone-200 px-2 text-sm" />
          {ranges.length > 1 && (
            <button type="button" onClick={() => setRanges(ranges.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100" aria-label="Aralığı kaldır">
              <X className="size-4" />
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => setRanges([...ranges, { start: "17:00", end: "20:00" }])} className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900">
        <Plus className="size-3.5" aria-hidden /> Aralık ekle
      </button>
    </div>
  );
}

export function ExceptionForm({ action, today }: { action: Action; today: string }) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action, { resetOnSuccess: true });
  const [kind, setKind] = useState<"CLOSED" | "CUSTOM_HOURS">("CLOSED");
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Result state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Başlangıç tarihi" name="startDate" error={fe?.startDate} required>
          <Input id="startDate" name="startDate" type="date" min={today} />
        </Field>
        <Field label="Bitiş tarihi" name="endDate" error={fe?.endDate} hint="Tek gün için boş bırakın.">
          <Input id="endDate" name="endDate" type="date" min={today} />
        </Field>
        <Field label="Durum" name="kind" error={fe?.kind}>
          <Select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="CLOSED">Kapalı</option>
            <option value="CUSTOM_HOURS">Özel çalışma saati</option>
          </Select>
        </Field>
        <Field label="Neden" name="reason">
          <Select id="reason" name="reason" defaultValue="SPECIAL">
            <option value="HOLIDAY">Resmî tatil / bayram</option>
            <option value="VACATION">Yıllık izin</option>
            <option value="SPECIAL">Özel gün</option>
            <option value="OTHER">Diğer</option>
          </Select>
        </Field>
      </div>
      {kind === "CUSTOM_HOURS" && (
        <Field label="O günlerin çalışma saatleri" name="ranges" group error={fe?.ranges}>
          <DayRangesInput name="ranges" />
        </Field>
      )}
      <Field label="Not" name="note" error={fe?.note}>
        <Input id="note" name="note" maxLength={120} placeholder="Örn. Bayram tatili" />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Kaydet</SubmitButton>
      </div>
    </form>
  );
}

export function TempCloseForm({ action }: { action: Action }) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Result state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ne zamana kadar kapalı?" name="until" error={fe?.until} required>
          <Input id="until" name="until" type="datetime-local" />
        </Field>
        <Field label="Müşterilere not" name="note" id="tempNote" error={fe?.note}>
          <Input id="tempNote" name="note" maxLength={120} placeholder="Örn. Tadilat nedeniyle kapalıyız" />
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton pending={pending} variant="dangerOutline">
          Geçici olarak kapat
        </SubmitButton>
      </div>
    </form>
  );
}
