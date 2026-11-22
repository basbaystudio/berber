import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { Store } from "lucide-react";
import { db } from "@/server/db/client";
import { businesses } from "@/server/db/schema";
import { getBusiness } from "@/server/auth/guards";
import { LoginForm } from "@/components/auth/login-form";
import { slugSchema } from "@/lib/validation/business";
import { businessLoginAction } from "@/app/isletme/auth-actions";

/** /isletme ve işletmeye özel /isletme/[slug]. Özel bağlantı yalnızca işletme adını gösterir, yetki vermez. */
export async function BusinessLoginScreen({ slug }: { slug?: string }) {
  if (await getBusiness()) redirect("/isletme/panel");
  let businessName: string | null = null;
  const parsed = slug ? slugSchema.safeParse(slug) : null;
  if (parsed?.success) {
    const [b] = await db
      .select({ name: businesses.name })
      .from(businesses)
      .where(and(eq(businesses.slug, parsed.data), ne(businesses.status, "SUSPENDED")))
      .limit(1);
    businessName = b?.name ?? null;
  }
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-stone-50 px-4 py-10">
      <a href="/" aria-label="Dijital Berber ana sayfa">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.png" alt="Dijital Berber" width={834} height={151} className="h-8 w-auto" />
      </a>
      <div className="w-full max-w-sm rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-10">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-900 text-white">
            <Store className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{businessName ?? "İşletme Paneli"}</h1>
            <p className="text-sm text-stone-500">İşletme e-postanız ve şifrenizle giriş yapın.</p>
          </div>
        </div>
        <LoginForm action={businessLoginAction} identifierLabel="E-posta veya kullanıcı adı" identifierAutoComplete="username" />
        <p className="mt-6 text-center text-xs text-stone-500">
          Giriş bilgilerinizi platform yönetimi verir. Şifrenizi unuttuysanız platform yönetimiyle iletişime geçin.
        </p>
      </div>
    </main>
  );
}
