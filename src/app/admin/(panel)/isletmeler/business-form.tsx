"use client";

import Link from "next/link";
import { Copy } from "lucide-react";
import { useState } from "react";
import type { ActionState } from "@/server/lib/action";
import { Alert, Card, CardHeader } from "@/components/ui/feedback";
import { Field, Input, SubmitButton, Textarea } from "@/components/ui/form";
import { Button, ButtonLink, buttonClass } from "@/components/ui/button";
import { useFormAction } from "@/components/ui/use-action";
import { LocationPicker } from "@/components/map/location-picker";
import { ProvinceDistrictSelect, type LocationOption } from "@/components/map/province-district-select";
import { formatTrPhone } from "@/lib/phone";
import type { CreatedBusiness } from "./actions";

export type BusinessFormDefaults = {
  name?: string;
  slug?: string;
  phone?: string;
  description?: string | null;
  addressLine?: string;
  provinceId?: number;
  districtId?: number;
  latitude?: number | null;
  longitude?: number | null;
};

function ProfileFields({ d, fe, locations, isEdit }: { d: BusinessFormDefaults; fe?: Record<string, string>; locations: LocationOption[]; isEdit: boolean }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="İşletme adı" name="name" error={fe?.name} required>
          <Input id="name" name="name" defaultValue={d.name} maxLength={80} required aria-invalid={!!fe?.name} />
        </Field>
        <Field
          label="Bağlantı adı"
          name="slug"
          error={fe?.slug}
          hint={isEdit ? "Değiştirirseniz eski profil bağlantısı çalışmaz." : "Boş bırakırsanız işletme adından otomatik oluşturulur."}
        >
          <div className="flex items-center rounded-xl border border-stone-200 bg-stone-50 focus-within:border-stone-400">
            <span className="pl-3 text-sm text-stone-500">/berber/</span>
            <input
              id="slug"
              name="slug"
              defaultValue={d.slug}
              maxLength={80}
              placeholder="ornek-berber"
              className="h-10 min-w-0 flex-1 rounded-r-xl bg-white px-2 text-sm focus:outline-none"
              aria-invalid={!!fe?.slug}
            />
          </div>
        </Field>
      </div>
      <Field label="Telefon" name="phone" error={fe?.phone} required>
        <Input id="phone" name="phone" type="tel" defaultValue={formatTrPhone(d.phone)} placeholder="0532 123 45 67" required aria-invalid={!!fe?.phone} />
      </Field>
      <Field label="Açıklama" name="description" error={fe?.description} hint="Müşterilerin profilde göreceği kısa tanıtım (en fazla 1000 karakter).">
        <Textarea id="description" name="description" rows={3} maxLength={1000} defaultValue={d.description ?? ""} />
      </Field>
      <ProvinceDistrictSelect locations={locations} defaultProvinceId={d.provinceId} defaultDistrictId={d.districtId} errors={fe} />
      <Field label="Açık adres" name="addressLine" error={fe?.addressLine} required>
        <Textarea id="addressLine" name="addressLine" rows={2} maxLength={300} defaultValue={d.addressLine} required aria-invalid={!!fe?.addressLine} />
      </Field>
      <LocationPicker defaultLat={d.latitude} defaultLng={d.longitude} errors={fe} />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
    >
      <Copy className="size-4" aria-hidden /> {done ? "Kopyalandı" : "Kopyala"}
    </Button>
  );
}

/** Geçici giriş bilgisi yalnızca bir kez gösterilir. */
export function CredentialsBox({ login, tempPassword, slug }: { login: string; tempPassword: string; slug?: string }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const loginUrl = slug ? `${origin}/isletme/${slug}` : `${origin}/isletme`;
  const all = `Giriş adresi: ${loginUrl}\nKullanıcı adı: ${login}\nGeçici şifre: ${tempPassword}`;
  return (
    <Alert tone="warning" title="Giriş bilgilerini şimdi kaydedin">
      <p>Bu geçici şifre güvenlik nedeniyle yalnızca bir kez gösterilir. İşletme ilk girişte şifresini değiştirmek zorundadır.</p>
      <dl className="mt-3 grid gap-1 rounded-lg bg-white/70 p-3 font-mono text-xs text-stone-800 sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt className="font-sans text-stone-500">Giriş adresi</dt>
        <dd className="break-all">{loginUrl}</dd>
        <dt className="font-sans text-stone-500">Kullanıcı adı</dt>
        <dd>{login}</dd>
        <dt className="font-sans text-stone-500">Geçici şifre</dt>
        <dd data-testid="temp-password">{tempPassword}</dd>
      </dl>
      <div className="mt-3">
        <CopyButton text={all} />
      </div>
    </Alert>
  );
}

export function CreateBusinessForm({
  action,
  locations,
}: {
  action: (p: ActionState<CreatedBusiness>, fd: FormData) => Promise<ActionState<CreatedBusiness>>;
  locations: LocationOption[];
}) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);

  if (state.status === "success" && state.data) {
    const r = state.data;
    return (
      <div className="space-y-4">
        <Alert tone="success" title="İşletme oluşturuldu">
          İşletme taslak durumunda. Profil tamamlandıktan sonra aktifleştirip yayına alabilirsiniz.
        </Alert>
        <CredentialsBox login={r.login} tempPassword={r.tempPassword} slug={r.slug} />
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/admin/isletmeler/${r.businessId}`}>İşletme detayına git</ButtonLink>
          {/* Tam sayfa yenileme: form durumunu temiz başlatır */}
          <a href="/admin/isletmeler/yeni" className={buttonClass({ variant: "outline" })}>
            Yeni işletme daha ekle
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      <Card>
        <CardHeader title="İşletme bilgileri" />
        <div className="p-5">
          <ProfileFields d={{}} fe={fe} locations={locations} isEdit={false} />
        </div>
      </Card>
      <Card>
        <CardHeader title="İşletme hesabı" description="İşletme paneline bu kullanıcı adıyla giriş yapılır. Geçici şifre otomatik üretilir." />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Yetkili adı soyadı" name="ownerName" error={fe?.ownerName} required>
            <Input id="ownerName" name="ownerName" maxLength={80} required aria-invalid={!!fe?.ownerName} />
          </Field>
          <Field label="Kullanıcı adı" name="login" error={fe?.login} hint="E-posta adresi ya da kısa bir kullanıcı adı olabilir." required>
            <Input id="login" name="login" autoCapitalize="none" spellCheck={false} maxLength={64} required aria-invalid={!!fe?.login} />
          </Field>
        </div>
      </Card>
      <div className="flex justify-end gap-2">
        <Link href="/admin/isletmeler" className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-stone-700 hover:bg-stone-100">
          Vazgeç
        </Link>
        <SubmitButton pending={pending} pendingText="Oluşturuluyor…">
          İşletmeyi oluştur
        </SubmitButton>
      </div>
    </form>
  );
}

export function EditBusinessForm({
  action,
  locations,
  defaults,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  locations: LocationOption[];
  defaults: BusinessFormDefaults;
}) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 p-5">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && <Alert tone="success">{state.message}</Alert>}
      <ProfileFields d={defaults} fe={fe} locations={locations} isEdit />
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Bilgileri kaydet</SubmitButton>
      </div>
    </form>
  );
}
