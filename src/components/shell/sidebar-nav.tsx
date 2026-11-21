"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV_ICONS, type NavIconName } from "./nav-icons";

export type NavItem = { href: string; label: string; icon: NavIconName; exact?: boolean };

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

function Links({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = isActive(pathname, item);
        const Icon = NAV_ICONS[item.icon];
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Masaüstünde sabit kenar çubuğu, mobilde açılır menü. */
export function SidebarNav({ items, brand, footer }: { items: NavItem[]; brand: React.ReactNode; footer: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col bg-slate-900 lg:flex">
        <div className="px-5 py-5">{brand}</div>
        <nav className="flex-1 px-3" aria-label="Ana menü">
          <Links items={items} />
        </nav>
        <div className="border-t border-white/10 p-4">{footer}</div>
      </aside>

      <div className="sticky top-0 z-30 flex items-center justify-between bg-slate-900 px-4 py-3 lg:hidden">
        {brand}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg p-2 text-slate-200 hover:bg-white/10"
          aria-expanded={open}
          aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="sticky top-[56px] z-20 bg-slate-900 px-3 pb-4 lg:hidden">
          <nav aria-label="Ana menü">
            <Links items={items} onNavigate={() => setOpen(false)} />
          </nav>
          <div className="mt-3 border-t border-white/10 pt-3">{footer}</div>
        </div>
      )}
    </>
  );
}
