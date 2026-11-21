import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth/customer-forms";
import { AuthCard } from "@/components/site/auth-card";
import { forgotPasswordAction } from "../auth-actions";

export const metadata: Metadata = { title: "Şifremi unuttum" };

export default function ForgotPage() {
  return (
    <AuthCard title="Şifremi unuttum" description="Hesabınıza kayıtlı e-posta adresini girin; şifre sıfırlama bağlantısı gönderelim.">
      <ForgotForm action={forgotPasswordAction} />
    </AuthCard>
  );
}
