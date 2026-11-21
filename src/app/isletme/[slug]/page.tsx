import type { Metadata } from "next";
import { BusinessLoginScreen } from "@/components/auth/business-login-screen";

export const metadata: Metadata = { title: "İşletme Girişi", robots: { index: false, follow: false } };

/** İşletmeye özel giriş bağlantısı: berber.com/isletme/<isletme-adi> */
export default async function BusinessSlugLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BusinessLoginScreen slug={slug} />;
}
