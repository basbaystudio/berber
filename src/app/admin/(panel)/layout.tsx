import type { Metadata } from "next";
import { LogOut, ShieldCheck } from "lucide-react";
import { getAdmin } from "@/server/auth/guards";
import { AdminLoginScreen } from "@/components/auth/admin-login-screen";
import { SidebarNav, type NavItem } from "@/components/shell/sidebar-nav";
import { adminLogoutAction } from "../auth-actions";

export const metadata: Metadata = { title: { default: "Yönetim", template: "%s · Yönetim" }, robots: { index: false, follow: false } };

const NAV: NavItem[] = [
  { href: "/admin", label: "Gösterge Paneli", icon: "dashboard", exact: true },
  { href: "/admin/isletmeler", label: "İşletmeler", icon: "businesses" },
  { href: "/admin/belgeler", label: "Belgeler", icon: "documents" },
  { href: "/admin/sozlesmeler", label: "Sözleşmeler", icon: "contracts" },
  { href: "/admin/yorumlar", label: "Yorum Şikâyetleri", icon: "reviews" },
  { href: "/admin/ayin-isletmesi", label: "Ayın İşletmesi", icon: "award" },
  { href: "/admin/abonelikler", label: "Abonelikler", icon: "billing" },
  { href: "/admin/bannerlar", label: "Banner ve Reklam", icon: "banners" },
  { href: "/admin/hizmet-turleri", label: "Hizmet Türleri", icon: "tags" },
  { href: "/admin/tatiller", label: "Resmî Tatiller", icon: "holidays" },
  { href: "/admin/kayitlar", label: "Denetim Kayıtları", icon: "logs" },
  { href: "/admin/ayarlar", label: "Platform Ayarları", icon: "settings" },
];

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAdmin();
  // Oturum yoksa /admin adresinde doğrudan giriş ekranı gösterilir; alt sayfalar /admin'e yönlendirir.
  if (!ctx) return <AdminLoginScreen />;
  const { admin } = ctx;
  return (
    <div className="lg:flex lg:min-h-dvh">
      <SidebarNav
        items={NAV}
        brand={
          <span className="flex items-center gap-2 font-semibold text-stone-900">
            <ShieldCheck className="size-5 text-accent-600" aria-hidden />
            Platform Yönetimi
          </span>
        }
        footer={
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-stone-900">{admin.name}</p>
              <p className="truncate text-xs text-stone-500">{admin.email}</p>
            </div>
            <form action={adminLogoutAction}>
              <button type="submit" className="rounded-xl p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900" title="Çıkış yap" aria-label="Çıkış yap">
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
