import { Building2, ClipboardList, LayoutDashboard, Tags, CalendarDays, Users, Scissors, Clock, Images, Settings, CreditCard, GalleryHorizontal, Store, Package, CalendarOff, FileCheck2, ScrollText, ListChecks, Contact } from "lucide-react";

/** Sunucu bileşenlerinden istemciye ikon bileşeni geçirilemediği için isimle eşlenir. */
export const NAV_ICONS = {
  dashboard: LayoutDashboard,
  businesses: Building2,
  tags: Tags,
  logs: ClipboardList,
  calendar: CalendarDays,
  users: Users,
  scissors: Scissors,
  clock: Clock,
  images: Images,
  settings: Settings,
  billing: CreditCard,
  banners: GalleryHorizontal,
  store: Store,
  package: Package,
  holidays: CalendarOff,
  documents: FileCheck2,
  contracts: ScrollText,
  list: ListChecks,
  customers: Contact,
} as const;

export type NavIconName = keyof typeof NAV_ICONS;
