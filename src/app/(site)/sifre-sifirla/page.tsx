import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/customer-forms";
import { AuthCard } from "@/components/site/auth-card";
import { Alert } from "@/components/ui/feedback";
import { resetPasswordAction } from "../auth-actions";

export const metadata: Metadata = { title: "Yeni şifre", robots: { index: false } };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthCard title="Yeni şifre belirleyin">
      {token ? <ResetForm action={resetPasswordAction} token={token} /> : <Alert tone="error">Bağlantı geçersiz.</Alert>}
    </AuthCard>
  );
}
