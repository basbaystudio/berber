import type { Metadata } from "next";
import { connection } from "next/server";
import { db } from "@/server/db/client";
import { getSetting } from "@/server/modules/platform/settings";

export const metadata: Metadata = { title: "Kullanım Koşulları" };

export default async function LegalPage() {
  await connection();
  const text = await getSetting(db, "legal.terms");
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-stone-900">Kullanım Koşulları</h1>
      {text ? (
        <div className="whitespace-pre-line rounded-3xl border border-stone-200/80 bg-white p-6 text-sm leading-relaxed text-stone-700 sm:p-8">{text}</div>
      ) : (
        <p className="text-stone-500">Bu metin hazırlanıyor.</p>
      )}
    </main>
  );
}
