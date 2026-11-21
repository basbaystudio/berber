import type { Metadata } from "next";
import { requireBusinessPage } from "@/server/auth/guards";
import { ChangePasswordForm } from "./form";
import { changePasswordAction } from "../auth-actions";

export const metadata: Metadata = { title: "Şifre Değiştir", robots: { index: false, follow: false } };

export default async function ChangePasswordPage() {
  const ctx = await requireBusinessPage({ allowPasswordChange: true });
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg sm:p-8">
        <h1 className="text-lg font-semibold">{ctx.user.mustChangePassword ? "Yeni şifrenizi belirleyin" : "Şifre değiştir"}</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">
          {ctx.user.mustChangePassword
            ? "Güvenliğiniz için size verilen geçici şifreyi değiştirmeniz gerekiyor."
            : "Şifrenizi değiştirdiğinizde diğer cihazlardaki oturumlarınız kapanır."}
        </p>
        <ChangePasswordForm action={changePasswordAction} />
      </div>
    </main>
  );
}
