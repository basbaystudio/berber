import Link from "next/link";
import { cn } from "@/lib/cn";

export function Pagination({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const link = (p: number, label: string, disabled: boolean) =>
    disabled ? (
      <span className="rounded-lg px-3 py-1.5 text-sm text-stone-500">{label}</span>
    ) : (
      <Link href={hrefFor(p)} className={cn("rounded-lg px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100")}>
        {label}
      </Link>
    );
  return (
    <nav className="flex items-center justify-between border-t border-stone-100 px-4 py-3" aria-label="Sayfalama">
      <p className="text-sm text-stone-500">
        Toplam {total} kayıt · Sayfa {page}/{pages}
      </p>
      <div className="flex gap-1">
        {link(page - 1, "‹ Önceki", page <= 1)}
        {link(page + 1, "Sonraki ›", page >= pages)}
      </div>
    </nav>
  );
}
