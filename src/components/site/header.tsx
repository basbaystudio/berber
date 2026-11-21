import Link from "next/link";
import { UserRound } from "lucide-react";
import { getCustomer } from "@/server/auth/guards";

export async function SiteHeader() {
  const ctx = await getCustomer();
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-stone-50/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center" aria-label="Dijital Berber ana sayfa">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="Dijital Berber" width={834} height={151} className="h-7 w-auto sm:h-8" />
        </Link>
        <nav className="flex items-center gap-1 text-sm" aria-label="Site menüsü">
          <Link href="/ara" className="hidden rounded-xl px-3 py-2 text-stone-600 hover:bg-stone-100 hover:text-stone-900 sm:block">
            Berber bul
          </Link>
          {ctx ? (
            <Link href="/hesabim" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-stone-800 hover:bg-stone-100">
              <UserRound className="size-4" aria-hidden />
              <span className="max-w-32 truncate">{ctx.customer.name.split(" ")[0]}</span>
            </Link>
          ) : (
            <>
              <Link href="/giris" className="rounded-xl px-3 py-2 text-stone-700 hover:bg-stone-100">
                Giriş yap
              </Link>
              <Link href="/kayit" className="rounded-xl bg-brand-900 px-3 py-2 text-white hover:bg-brand-800">
                Kayıt ol
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-stone-200/70">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-stone-500 sm:px-6">
        <span>© {new Date().getFullYear()} Dijital Berber</span>
        <nav className="flex flex-wrap gap-4" aria-label="Alt menü">
          <Link href="/ara" className="hover:text-stone-900">
            Berber bul
          </Link>
          <Link href="/kvkk-aydinlatma" className="hover:text-stone-900">
            KVKK Aydınlatma Metni
          </Link>
          <Link href="/kullanim-kosullari" className="hover:text-stone-900">
            Kullanım Koşulları
          </Link>
          <Link href="/isletme" className="hover:text-stone-900">
            İşletme girişi
          </Link>
        </nav>
      </div>
    </footer>
  );
}
