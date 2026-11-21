import type { Metadata } from "next";
import Link from "next/link";
import { Bell, LogOut, Store } from "lucide-react";
import { db } from "@/server/db/client";
import { unreadCount } from "@/server/modules/business/inbox";
import { pendingContractVersions } from "@/server/modules/business/contracts";
import { Alert } from "@/components/ui/feedback";
import { PaymentRequiredModal } from "@/components/panel/payment-required-modal";
import { getBusinessSubscription } from "@/server/modules/billing/subscriptions";
import { needsPaymentSetup } from "@/server/modules/billing/status";
import { formatTL } from "@/lib/money";
import { todayTR } from "@/lib/dates";
import { requireBusinessPage } from "@/server/auth/guards";
import { SidebarNav, type NavItem } from "@/components/shell/sidebar-nav";
import { businessLogoutAction } from "../auth-actions";

export const metadata: Metadata = { title: { default: "İşletme Paneli", template: "%s · İşletme Paneli" }, robots: { index: false, follow: false } };

const NAV: NavItem[] = [
  { href: "/isletme/panel", label: "Genel Bakış", icon: "dashboard", exact: true },
  { href: "/isletme/panel/takvim", label: "Takvim", icon: "calendar" },
  { href: "/isletme/panel/randevular", label: "Randevular", icon: "list" },
  { href: "/isletme/panel/musteriler", label: "Müşteriler", icon: "customers" },
  { href: "/isletme/panel/yorumlar", label: "Yorumlar", icon: "reviews" },
  { href: "/isletme/panel/calisma-saatleri", label: "Çalışma Saatleri", icon: "clock" },
  { href: "/isletme/panel/calisanlar", label: "Çalışanlar", icon: "users" },
  { href: "/isletme/panel/hizmetler", label: "Hizmetler", icon: "scissors" },
  { href: "/isletme/panel/paketler", label: "Paketler", icon: "package" },
  { href: "/isletme/panel/portfolyo", label: "Portfolyo", icon: "images" },
  { href: "/isletme/panel/belgeler", label: "Belgelerim", icon: "documents" },
  { href: "/isletme/panel/sozlesmeler", label: "Sözleşmeler", icon: "contracts" },
  { href: "/isletme/panel/abonelik", label: "Abonelik", icon: "billing" },
  { href: "/isletme/panel/profil", label: "İşletme Profili", icon: "store" },
  { href: "/isletme/panel/ayarlar", label: "Randevu Ayarları", icon: "settings" },
];

export default async function BusinessPanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireBusinessPage();
  const [unread, pendingContracts, sub] = [
    await unreadCount(db, ctx.businessId),
    await pendingContractVersions(db, ctx.businessId),
    await getBusinessSubscription(db, ctx.businessId),
  ];
  const mustPay = sub ? needsPaymentSetup(sub.sub, sub.billingEnabled, todayTR()) : false;
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
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex justify-end">
            <Link
              href="/isletme/panel/bildirimler"
              className="relative inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              aria-label={unread ? `Bildirimler, ${unread} okunmamış` : "Bildirimler"}
            >
              <Bell className="size-4" aria-hidden />
              Bildirimler
              {unread > 0 && <span className="rounded-full bg-stone-900 px-1.5 text-xs font-medium text-white tabular-nums">{unread}</span>}
            </Link>
          </div>
          {mustPay && sub && (
            <PaymentRequiredModal
              title={sub.sub.isEarlyAdopter || sub.sub.trialMonths > 0 ? "Ücretsiz deneme süreniz sona erdi" : "Ücretsiz kullanım süreniz sona erdi"}
              feeText={`Bu aydan itibaren aylık ödemeniz: ${formatTL(sub.sub.monthlyFeeKurus)}`}
              logoutAction={businessLogoutAction}
            />
          )}
          {pendingContracts.length > 0 && (
            <Alert tone="warning" className="mb-6" title="Onayınızı bekleyen sözleşme var">
              {pendingContracts.map((c) => c.title).join(", ")} güncellendi.{" "}
              <Link href="/isletme/panel/sozlesmeler" className="font-medium underline underline-offset-4">
                Göz atıp onaylayın
              </Link>
            </Alert>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
