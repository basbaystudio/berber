"use client";

import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4">
      <Alert tone="error" title="Sayfa yüklenemedi">
        Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin; sorun sürerse kayıtlara bakın.
      </Alert>
      <Button variant="outline" onClick={reset}>
        Tekrar dene
      </Button>
    </div>
  );
}
