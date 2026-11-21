import type { Metadata } from "next";
import { LogOut, ShieldCheck } from "lucide-react";
import { requireAdminPage } from "@/server/auth/guards";
import { SidebarNav, type NavItem } from "@/components/shell/sidebar-nav";
import { adminLogoutAction } from "../auth-actions";

export const metadata: Metadata = { title: { default: "Yönetim", template: "%s · Yönetim" }, robots: { index: false, follow: false } };

const NAV: NavItem[] = [
  { href: "/admin", label: "Gösterge Paneli", icon: "dashboard", exact: true },
  { href: "/admin/isletmeler", label: "İşletmeler", icon: "businesses" },
  { href: "/admin/hizmet-turleri", label: "Hizmet Türleri", icon: "tags" },
  { href: "/admin/kayitlar", label: "Denetim Kayıtları", icon: "logs" },
];

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdminPage();
  return (
    <div className="lg:flex lg:min-h-dvh">
      <SidebarNav
        items={NAV}
        brand={
          <span className="flex items-center gap-2 font-semibold text-white">
            <ShieldCheck className="size-5 text-accent-500" aria-hidden />
            Platform Yönetimi
          </span>
        }
        footer={
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{admin.name}</p>
              <p className="truncate text-xs text-slate-400">{admin.email}</p>
            </div>
            <form action={adminLogoutAction}>
              <button type="submit" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white" title="Çıkış yap" aria-label="Çıkış yap">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        }
      />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
