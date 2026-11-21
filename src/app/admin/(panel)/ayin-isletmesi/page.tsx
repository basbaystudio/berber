import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireAdminPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { businesses, monthlyAwards } from "@/server/db/schema";
import { monthlyRanking } from "@/server/modules/reviews/reviews";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionButton } from "@/components/ui/action-button";
import { todayTR } from "@/lib/dates";
import { awardAction } from "./actions";

export const metadata = { title: "Ayın İşletmesi" };
const label = (m: string) => new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));

export default async function AwardsPage({ searchParams }: { searchParams: Promise<{ ay?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const now = todayTR().slice(0, 7);
  const [y, m] = now.split("-").map(Number) as [number, number];
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const month = sp.ay && /^\d{4}-\d{2}$/.test(sp.ay) ? sp.ay : prev;
  const r = await monthlyRanking(db, month);
  const past = await db
    .select({ month: monthlyAwards.month, name: businesses.name, id: businesses.id, n: monthlyAwards.reviewCount, avg: monthlyAwards.ratingAvg })
    .from(monthlyAwards)
    .innerJoin(businesses, eq(businesses.id, monthlyAwards.businessId))
    .orderBy(desc(monthlyAwards.month))
    .limit(24);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return d.toISOString().slice(0, 7);
  });
  return (
    <>
      <PageHeader
        title="Ayın İşletmesi"
        description={`Ay içinde en az ${r.minReviews} yorum almış ve güven puanı ${r.threshold} ve üzerindeki işletmeler, ağırlıklı yıldız ortalamasına göre sıralanır. Kazananı siz onaylarsınız.`}
      />
      <form className="mb-4 flex items-center gap-2 text-sm">
        <label htmlFor="ay" className="text-stone-600">
          Ay
        </label>
        <select id="ay" name="ay" defaultValue={month} className="h-9 rounded-xl border border-stone-200 bg-white px-2">
          {months.map((x) => (
            <option key={x} value={x}>
              {label(x)}
              {x === now ? " (devam ediyor)" : ""}
            </option>
          ))}
        </select>
        <button type="submit" className="h-9 rounded-xl border border-stone-200 px-3 hover:bg-stone-50">
          Göster
        </button>
      </form>
      <Card className="mb-6">
        <CardHeader title={`${label(month)} sıralaması`} actions={r.award ? <Badge tone="green">Ödül verildi</Badge> : undefined} />
        {r.rows.length === 0 ? (
          <EmptyState title="Şartları sağlayan işletme yok" description={`Bu ay en az ${r.minReviews} yorum alan işletme bulunmuyor.`} />
        ) : (
          <ol className="divide-y divide-stone-100">
            {r.rows.map((x, i) => (
              <li key={x.businessId} className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm">
                <span className="w-6 font-semibold tabular-nums text-stone-400">{i + 1}</span>
                <Link href={`/admin/isletmeler/${x.businessId}`} className="min-w-0 flex-1 font-medium text-stone-900 hover:text-accent-600">
                  {x.name}
                </Link>
                <span className="text-stone-600">
                  ★ {x.avg.toFixed(2)} · {x.reviewCount} yorum · ağırlıklı {x.weighted.toFixed(2)}
                </span>
                <span className={x.eligible ? "text-stone-500" : "text-red-600"}>Güven {Math.round(x.trust)}</span>
                {r.award?.businessId === x.businessId ? (
                  <Badge tone="green">Kazanan</Badge>
                ) : !r.award && x.eligible && month !== now ? (
                  <ActionButton action={awardAction.bind(null, month, x.businessId)} variant={i === 0 ? "primary" : "outline"} confirm={`${x.name} ${label(month)} Ayın İşletmesi seçilsin mi?`}>
                    Ödülü ver
                  </ActionButton>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        {month === now && <p className="border-t border-stone-100 px-6 py-3 text-xs text-stone-500">Ay bitmeden ödül verilemez.</p>}
      </Card>
      <Card>
        <CardHeader title="Geçmiş kazananlar" />
        {past.length === 0 ? (
          <EmptyState title="Henüz ödül verilmedi" />
        ) : (
          <ul className="divide-y divide-stone-100">
            {past.map((p) => (
              <li key={p.month} className="flex justify-between gap-3 px-6 py-3 text-sm">
                <span className="text-stone-500">{label(p.month)}</span>
                <Link href={`/admin/isletmeler/${p.id}`} className="font-medium text-stone-900 hover:text-accent-600">
                  {p.name} · ★ {Number(p.avg).toFixed(2)} ({p.n})
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
