import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { Store } from "lucide-react";
import { db } from "@/server/db/client";
import { businesses } from "@/server/db/schema";
import { getBusiness } from "@/server/auth/guards";
import { LoginForm } from "@/components/auth/login-form";
import { slugSchema } from "@/lib/validation/business";
import { businessLoginAction } from "../../auth-actions";

export const metadata: Metadata = { title: "İşletme Girişi", robots: { index: false, follow: false } };

/** /isletme/giris ve işletmeye özel /isletme/giris/[slug]. Özel bağlantı yalnızca işletme adını gösterir, yetki vermez. */
export default async function BusinessLoginPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  if (await getBusiness()) redirect("/isletme/panel");
  const { slug } = await params;
  let businessName: string | null = null;
  const parsed = slug?.length === 1 ? slugSchema.safeParse(slug[0]) : null;
  if (parsed?.success) {
    const [b] = await db
      .select({ name: businesses.name })
      .from(businesses)
      .where(and(eq(businesses.slug, parsed.data), ne(businesses.status, "SUSPENDED")))
      .limit(1);
    businessName = b?.name ?? null;
  }
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
            <Store className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{businessName ?? "İşletme Paneli"}</h1>
            <p className="text-sm text-slate-500">İşletme hesabınızla giriş yapın.</p>
          </div>
        </div>
        <LoginForm action={businessLoginAction} identifierLabel="Kullanıcı adı" />
        <p className="mt-6 text-center text-xs text-slate-500">
          Giriş bilgilerinizi platform yönetimi verir. Şifrenizi unuttuysanız platform yönetimiyle iletişime geçin.
        </p>
      </div>
    </main>
  );
}
