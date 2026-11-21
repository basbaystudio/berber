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
    <ul className="space-y-0.5">
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
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                active ? "bg-stone-100 font-medium text-stone-900" : "text-stone-500 hover:bg-stone-50 hover:text-stone-900",
              )}
            >
              <Icon className={cn("size-4", active ? "text-accent-600" : "text-stone-400")} aria-hidden />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Masaüstünde sabit, açık renkli kenar çubuğu; mobilde açılır menü. */
export function SidebarNav({ items, brand, footer }: { items: NavItem[]; brand: React.ReactNode; footer: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-stone-200/80 bg-white lg:flex">
        <div className="px-6 py-6">{brand}</div>
        <nav className="flex-1 overflow-y-auto px-3" aria-label="Ana menü">
          <Links items={items} />
        </nav>
        <div className="border-t border-stone-100 p-4">{footer}</div>
      </aside>

      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200/80 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        {brand}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-xl p-2 text-stone-600 hover:bg-stone-100"
          aria-expanded={open}
          aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="sticky top-[57px] z-20 border-b border-stone-200/80 bg-white px-3 pb-4 pt-2 lg:hidden">
          <nav aria-label="Ana menü">
            <Links items={items} onNavigate={() => setOpen(false)} />
          </nav>
          <div className="mt-3 border-t border-stone-100 pt-3">{footer}</div>
        </div>
      )}
    </>
  );
}
