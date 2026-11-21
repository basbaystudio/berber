"use client";

import { useState } from "react";
import { Copy, Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { WEEKDAYS, type TimeRange, type WeeklyRanges } from "@/lib/schedule";
import { Button } from "@/components/ui/button";

/**
 * Haftalık program düzenleyici (gün başına birden çok aralık). Değer gizli bir alana JSON olarak yazılır.
 * İşletme çalışma saatleri, çalışan vardiyaları ve molalar için kullanılır.
 */
export function WeeklyEditor({
  name,
  defaultValue,
  emptyLabel = "Kapalı",
  activeLabel = "Açık",
  defaultRange = { start: "09:00", end: "19:00" },
  copySource,
}: {
  name: string;
  defaultValue: WeeklyRanges;
  emptyLabel?: string;
  activeLabel?: string;
  defaultRange?: TimeRange;
  copySource?: { label: string; value: WeeklyRanges };
}) {
  const [week, setWeek] = useState<WeeklyRanges>(defaultValue);

  const setDay = (wd: number, ranges: TimeRange[]) => setWeek((w) => ({ ...w, [wd]: ranges }));
  const update = (wd: number, i: number, key: keyof TimeRange, v: string) =>
    setDay(wd, (week[wd] ?? []).map((r, j) => (j === i ? { ...r, [key]: v } : r)));

  const copyMondayToWeekdays = () => {
    const mon = week[1] ?? [];
    setWeek((w) => ({ ...w, 2: mon, 3: mon, 4: mon, 5: mon }));
  };

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(Object.fromEntries(Object.entries(week).filter(([, r]) => r.length)))} />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={copyMondayToWeekdays}>
          <Copy className="size-3.5" aria-hidden /> Pazartesiyi hafta içine kopyala
        </Button>
        {copySource && (
          <Button variant="secondary" size="sm" onClick={() => setWeek(copySource.value)}>
            <Copy className="size-3.5" aria-hidden /> {copySource.label}
          </Button>
        )}
      </div>
      <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200/80">
        {WEEKDAYS.map((d) => {
          const ranges = week[d.value] ?? [];
          const on = ranges.length > 0;
          return (
            <li key={d.value} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start">
              <div className="flex w-full items-center justify-between sm:w-44 sm:pt-1.5">
                <span className="text-sm font-medium text-stone-800">{d.label}</span>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-stone-500">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={on}
                    onChange={(e) => setDay(d.value, e.target.checked ? [defaultRange] : [])}
                    aria-label={`${d.label} ${activeLabel.toLocaleLowerCase("tr-TR")}`}
                  />
                  <span className={cn("relative h-5 w-9 rounded-full transition-colors", on ? "bg-stone-900" : "bg-stone-200")}>
                    <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-all", on ? "left-[18px]" : "left-0.5")} />
                  </span>
                  <span className="w-14">{on ? activeLabel : emptyLabel}</span>
                </label>
              </div>
              {on && (
                <div className="flex flex-1 flex-col gap-2">
                  {ranges.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="time"
                        step={300}
                        value={r.start}
                        onChange={(e) => update(d.value, i, "start", e.target.value)}
                        aria-label={`${d.label} ${i + 1}. aralık başlangıç`}
                        className="h-9 w-28 rounded-xl border border-stone-200 px-2 text-sm"
                      />
                      <span className="text-stone-400">–</span>
                      <input
                        type="time"
                        step={300}
                        value={r.end}
                        onChange={(e) => update(d.value, i, "end", e.target.value)}
                        aria-label={`${d.label} ${i + 1}. aralık bitiş`}
                        className="h-9 w-28 rounded-xl border border-stone-200 px-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setDay(d.value, ranges.filter((_, j) => j !== i))}
                        className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                        aria-label="Aralığı kaldır"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                  {ranges.length < 6 && (
                    <button
                      type="button"
                      onClick={() => {
                        const last = ranges.at(-1);
                        setDay(d.value, [...ranges, last ? { start: last.end, end: last.end < "22:00" ? "22:00" : "23:55" } : defaultRange]);
                      }}
                      className="inline-flex w-fit items-center gap-1 text-xs text-stone-500 hover:text-stone-900"
                    >
                      <Plus className="size-3.5" aria-hidden /> Aralık ekle
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
