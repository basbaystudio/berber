import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCustomer } from "@/server/auth/guards";
import { customerLogoutAction } from "../auth-actions";
import { VerifyBanner } from "./verify-banner";
import { resendVerificationAction } from "../auth-actions";

export const metadata: Metadata = { title: { default: "Hesabım", template: "%s · Hesabım" }, robots: { index: false } };

const TABS = [
  ["/hesabim", "Özet"],
  ["/hesabim/randevular", "Randevularım"],
  ["/hesabim/favoriler", "Favorilerim"],
  ["/hesabim/ayarlar", "Ayarlar"],
] as const;

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCustomer();
  if (!ctx) redirect("/giris?next=/hesabim");
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Merhaba, {ctx.customer.name.split(" ")[0]}</h1>
          <p className="text-sm text-stone-500">{ctx.customer.email}</p>
        </div>
        <form action={customerLogoutAction}>
          <button type="submit" className="text-sm text-stone-500 hover:text-stone-900">
            Çıkış yap
          </button>
        </form>
      </div>
      {!ctx.customer.emailVerified && <VerifyBanner action={resendVerificationAction} />}
      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-stone-100 p-1 text-sm" aria-label="Hesap menüsü">
        {TABS.map(([href, label]) => (
          <Link key={href} href={href} className="shrink-0 rounded-xl px-4 py-2 text-stone-600 hover:bg-white hover:text-stone-900">
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </main>
  );
}
