import type { Metadata } from "next";
import { LogOut, Store } from "lucide-react";
import { requireBusinessPage } from "@/server/auth/guards";
import { SidebarNav, type NavItem } from "@/components/shell/sidebar-nav";
import { businessLogoutAction } from "../auth-actions";

export const metadata: Metadata = { title: { default: "İşletme Paneli", template: "%s · İşletme Paneli" }, robots: { index: false, follow: false } };

// Diğer menüler (takvim, çalışanlar, hizmetler, çalışma saatleri, portfolyo...) Aşama 3-4'te eklenecek.
const NAV: NavItem[] = [{ href: "/isletme/panel", label: "Genel Bakış", icon: "dashboard", exact: true }];

export default async function BusinessPanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireBusinessPage();
  return (
    <div className="lg:flex lg:min-h-dvh">
      <SidebarNav
        items={NAV}
        brand={
          <span className="flex min-w-0 items-center gap-2 font-semibold text-white">
            <Store className="size-5 shrink-0 text-accent-500" aria-hidden />
            <span className="truncate">{ctx.business.name}</span>
          </span>
        }
        footer={
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{ctx.user.name}</p>
              <a href="/isletme/sifre-degistir" className="text-xs text-slate-400 hover:text-white">
                Şifre değiştir
              </a>
            </div>
            <form action={businessLogoutAction}>
              <button type="submit" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white" title="Çıkış yap" aria-label="Çıkış yap">
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
