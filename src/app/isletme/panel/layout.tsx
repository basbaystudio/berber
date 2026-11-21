import type { Metadata } from "next";
import { LogOut, Store } from "lucide-react";
import { requireBusinessPage } from "@/server/auth/guards";
import { SidebarNav, type NavItem } from "@/components/shell/sidebar-nav";
import { businessLogoutAction } from "../auth-actions";

export const metadata: Metadata = { title: { default: "İşletme Paneli", template: "%s · İşletme Paneli" }, robots: { index: false, follow: false } };

// Takvim ve randevular Aşama 4'te eklenecek.
const NAV: NavItem[] = [
  { href: "/isletme/panel", label: "Genel Bakış", icon: "dashboard", exact: true },
  { href: "/isletme/panel/calisma-saatleri", label: "Çalışma Saatleri", icon: "clock" },
  { href: "/isletme/panel/calisanlar", label: "Çalışanlar", icon: "users" },
  { href: "/isletme/panel/hizmetler", label: "Hizmetler", icon: "scissors" },
  { href: "/isletme/panel/paketler", label: "Paketler", icon: "package" },
  { href: "/isletme/panel/portfolyo", label: "Portfolyo", icon: "images" },
  { href: "/isletme/panel/profil", label: "İşletme Profili", icon: "store" },
];

export default async function BusinessPanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireBusinessPage();
  return (
    <div className="lg:flex lg:min-h-dvh">
      <SidebarNav
        items={NAV}
        brand={
          <span className="flex min-w-0 items-center gap-2 font-semibold text-stone-900">
            <Store className="size-5 shrink-0 text-accent-600" aria-hidden />
            <span className="truncate">{ctx.business.name}</span>
          </span>
        }
        footer={
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-stone-900">{ctx.user.name}</p>
              <a href="/isletme/sifre-degistir" className="text-xs text-stone-500 hover:text-stone-900">
                Şifre değiştir
              </a>
            </div>
            <form action={businessLogoutAction}>
              <button type="submit" className="rounded-xl p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-900" title="Çıkış yap" aria-label="Çıkış yap">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        }
      />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
