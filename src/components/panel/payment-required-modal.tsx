"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { CreditCard } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";

/**
 * Ücretsiz süre bitince gösterilen, KAPATILAMAYAN uyarı penceresi.
 * Abonelik sayfasında pencere yerine sabit uyarı gösterilir (kart bilgisi girilebilsin diye).
 */
export function PaymentRequiredModal({ title, feeText, logoutAction }: { title: string; feeText: string; logoutAction: () => Promise<void> }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const onBillingPage = pathname.startsWith("/isletme/panel/abonelik");

  useEffect(() => {
    if (onBillingPage) return;
    ref.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [onBillingPage]);

  const body = (
    <>
      <p>Hizmetinizin kesintisiz devam etmesi için lütfen kart bilgilerinizi girin ya da havale / EFT ile ödeme yapın.</p>
      <p className="mt-1 font-medium text-stone-900">{feeText}</p>
    </>
  );

  if (onBillingPage)
    return (
      <Alert tone="warning" title={title} className="mb-6">
        {body}
      </Alert>
    );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-stone-900/40 p-4 backdrop-blur-sm">
      <div
        ref={ref}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="payment-required-title"
        className="w-full max-w-md rounded-3xl border border-stone-200/80 bg-white p-6 text-sm text-stone-600 outline-none sm:p-8"
      >
        <span className="mb-4 grid size-11 place-items-center rounded-2xl bg-brand-900 text-white">
          <CreditCard className="size-5" aria-hidden />
        </span>
        <h2 id="payment-required-title" className="mb-2 text-lg font-semibold text-stone-900">
          {title}
        </h2>
        {body}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <Link href="/isletme/panel/abonelik" className={buttonClass({ size: "lg" }, "flex-1")}>
            Ödeme yap
          </Link>
          <form action={logoutAction} className="flex-1">
            <button type="submit" className={buttonClass({ variant: "ghost", size: "lg" }, "w-full")}>
              Çıkış yap
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
