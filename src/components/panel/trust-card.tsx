import { CheckCircle2, CircleAlert } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";

/** Güven puanı ve gerekçeleri (işletme paneli ve admin). */
export function TrustCard({ score, reasons, belowThreshold, threshold, forAdmin }: { score: number; reasons: { ok: boolean; text: string }[]; belowThreshold: boolean; threshold: number; forAdmin?: boolean }) {
  return (
    <Card>
      <CardHeader
        title="Güven puanı"
        description={
          forAdmin
            ? "Son 30 günün onaylama, yanıt hızı, iptal, sonuçlandırma ve panel kullanımından hesaplanır."
            : "Pazaryerindeki sıralamanızı etkiler. Talepleri hızlı onaylayın, randevuları sonuçlandırın."
        }
      />
      <div className="space-y-4 p-6">
        <div className="flex items-end gap-3">
          <span className={cn("text-4xl font-semibold tabular-nums", belowThreshold ? "text-red-700" : "text-stone-900")}>{Math.round(score)}</span>
          <span className="pb-1 text-sm text-stone-500">/ 100</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-stone-200" aria-hidden>
          <div className={cn("h-full rounded-full", belowThreshold ? "bg-red-500" : "bg-stone-800")} style={{ width: `${Math.min(100, score)}%` }} />
        </div>
        {belowThreshold && <p className="text-sm text-red-700">Puan {threshold} altında: öne çıkanlar ve “bugün müsait” vitrinlerinde gösterilmez.</p>}
        {reasons.length > 0 && (
          <ul className="space-y-1.5 text-sm">
            {reasons.map((r) => (
              <li key={r.text} className="flex gap-2">
                {r.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />}
                <span className="text-stone-700">{r.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
