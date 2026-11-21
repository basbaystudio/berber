import type { Metadata } from "next";
import { db } from "@/server/db/client";
import { AppError } from "@/server/lib/errors";
import { verifyEmail } from "@/server/modules/customer/auth";
import { AuthCard } from "@/components/site/auth-card";
import { Alert } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "E-posta doğrulama", robots: { index: false } };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  let error: string | null = null;
  try {
    await verifyEmail(db, token ?? "");
  } catch (e) {
    if (e instanceof AppError) error = e.message;
    else throw e;
  }
  return (
    <AuthCard title="E-posta doğrulama">
      {error ? <Alert tone="error">{error}</Alert> : <Alert tone="success">E-posta adresiniz doğrulandı. Artık randevu alabilirsiniz.</Alert>}
      <div className="mt-6 flex gap-2">
        <ButtonLink href="/ara">Berber bul</ButtonLink>
        <ButtonLink href="/hesabim" variant="outline">
          Hesabım
        </ButtonLink>
      </div>
    </AuthCard>
  );
}
