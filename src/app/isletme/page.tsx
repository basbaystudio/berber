import type { Metadata } from "next";
import { BusinessLoginScreen } from "@/components/auth/business-login-screen";

export const metadata: Metadata = { title: "İşletme Girişi", robots: { index: false, follow: false } };

export default function BusinessLoginPage() {
  return <BusinessLoginScreen />;
}
