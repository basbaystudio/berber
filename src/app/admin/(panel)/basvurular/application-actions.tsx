"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import type { ApprovedInfo } from "./actions";

export function ApplicationActions({
  approve,
  reject,
}: {
  approve: () => Promise<ActionState<ApprovedInfo>>;
  reject: (reason: string) => Promise<ActionState>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState<ApprovedInfo> | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  if (result?.status === "success" && result.data) {
    const d = result.data;
    return (
      <Alert tone="success" title="İşletme oluşturuldu">
        <p>
          {d.trialMonths} ay ücretsiz{d.isEarlyAdopter ? " (kampanya)" : ""} tanımlandı. Giriş bilgileri başvurana e-postayla gönderildi.
        </p>
        <p className="mt-1">
          Kullanıcı adı: <b className="font-mono">{d.login}</b> · Geçici şifre: <b className="font-mono" data-testid="temp-password">{d.tempPassword}</b>
        </p>
        <div className="mt-2 flex gap-3">
          <Link href={`/admin/isletmeler/${d.businessId}`} className="font-medium underline underline-offset-4">
            İşletmeye git
          </Link>
          <button type="button" className="underline underline-offset-4" onClick={() => router.refresh()}>
            Listeyi yenile
          </button>
        </div>
      </Alert>
    );
  }
  return (
    <div className="space-y-2">
      {result?.status === "error" && <Alert tone="error">{result.message}</Alert>}
      {rejecting ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input aria-label="Red açıklaması" placeholder="Açıklama (isteğe bağlı, başvurana gönderilir)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className="min-w-64 flex-1" />
          <Button variant="dangerOutline" disabled={pending} onClick={() => start(async () => setResult(await reject(reason)))}>
            Reddet
          </Button>
          <Button variant="ghost" onClick={() => setRejecting(false)}>
            Vazgeç
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={pending}
            onClick={() => {
              if (confirm("İşletme ve hesabı oluşturulacak, giriş bilgileri başvurana e-postayla gönderilecek. Onaylıyor musunuz?")) start(async () => setResult(await approve()));
            }}
          >
            {pending ? "İşleniyor…" : "Onayla ve işletmeyi oluştur"}
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => setRejecting(true)}>
            Reddet
          </Button>
        </div>
      )}
    </div>
  );
}
