import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getAdmin } from "@/server/auth/guards";
import { LoginForm } from "@/components/auth/login-form";
import { adminLoginAction } from "../auth-actions";

export const metadata: Metadata = { title: "Yönetici Girişi", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  if (await getAdmin()) redirect("/admin");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-900 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-slate-900 text-white">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Platform Yönetimi</h1>
            <p className="text-sm text-slate-500">Yalnızca yetkili yöneticiler içindir.</p>
          </div>
        </div>
        <LoginForm action={adminLoginAction} identifierLabel="E-posta" identifierType="email" identifierAutoComplete="email" />
      </div>
    </main>
  );
}
