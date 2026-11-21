import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { db } from "@/server/db/client";
import { getCustomer } from "@/server/auth/guards";
import { getBookingCatalog } from "@/server/modules/marketplace/profile";
import { getBookingSettings } from "@/server/modules/business/settings";
import { BookingWizard } from "@/components/marketplace/booking-wizard";
import { todayTR } from "@/lib/dates";
import { bookOnlineAction, getPublicSlotsAction } from "../../actions";
import { resendVerificationAction } from "../../../auth-actions";

export const metadata: Metadata = { title: "Randevu al", robots: { index: false } };

export default async function BookingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await connection();
  const { slug } = await params;
  const sp = await searchParams;
  const cat = await getBookingCatalog(db, slug);
  if (!cat) notFound();
  const customer = await getCustomer();
  const settings = await getBookingSettings(db, cat.profile.id);
  const auth = !customer ? "guest" : customer.customer.emailVerified ? "ok" : "unverified";
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link href={`/berber/${slug}`} className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900">
        <ArrowLeft className="size-4" aria-hidden /> {cat.profile.name}
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-stone-900">Randevu al</h1>
      <BookingWizard
        slug={slug}
        services={cat.services}
        packages={cat.packages}
        staff={cat.profile.staff}
        initial={{ h: sp.h ? sp.h.split(",").slice(0, 10) : [], p: sp.p, c: sp.c, t: sp.t, s: sp.s }}
        today={todayTR()}
        maxDays={settings.maxAdvanceDays}
        auth={auth}
        fetchSlots={getPublicSlotsAction.bind(null, slug)}
        book={bookOnlineAction.bind(null, slug)}
        resend={resendVerificationAction}
      />
    </main>
  );
}
