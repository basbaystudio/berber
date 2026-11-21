import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { adminLoginAction } from "@/app/admin/auth-actions";

/** /admin adresinde oturum yoksa gösterilen yönetici giriş ekranı. */
export function AdminLoginScreen() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-stone-50 px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-10">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-stone-900 text-white">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Platform Yönetimi</h1>
            <p className="text-sm text-stone-500">Yalnızca yetkili yöneticiler içindir.</p>
          </div>
        </div>
        <LoginForm action={adminLoginAction} identifierLabel="E-posta" identifierType="email" identifierAutoComplete="email" />
      </div>
    </main>
  );
}
