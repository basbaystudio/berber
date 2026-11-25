import Link from "next/link";
import { CalendarCheck, Clock, LayoutDashboard, MessageCircle, Percent, Store, Tag, Users } from "lucide-react";

/**
 * Lansman modundaki ana sayfa: pazaryeri listesi yerine berberlere yönelik tanıtım.
 * Müşteriler berberlerinin paylaştığı bağlantıdan (dijitalberber.com/berber/<ad>) randevu alır.
 */
export function LaunchHome({ freeMonths }: { freeMonths: number }) {
  const features = [
    { icon: CalendarCheck, title: "Online randevu", text: "Müşterileriniz boş saatlerinizi görüp kendileri randevu alır; gece gelen randevu da kaçmaz." },
    { icon: MessageCircle, title: "Telefon trafiği azalır", text: "\"Yarın 3'te yer var mı?\" telefonları biter, makas elinizden düşmez." },
    { icon: Users, title: "Çalışanlarınız tek ekranda", text: "Kimin hangi saatte kimi tıraş edeceği, izinler ve mesailer düzenli." },
    { icon: LayoutDashboard, title: "Kazancınızı görün", text: "Günlük, haftalık ve aylık ciro; en çok tercih edilen hizmetler." },
    { icon: Clock, title: "Hatırlatmalar", text: "Müşteriye randevusu hatırlatılır, gelmeyenler azalır." },
    { icon: Percent, title: "Komisyon yok", text: "Randevu başına para kesilmez; sabit, düşük aylık ücret." },
  ];
  return (
    <main className="mx-auto max-w-6xl space-y-14 px-4 pb-10 pt-8 sm:px-6">
      <section className="grid items-center gap-8 rounded-3xl bg-brand-900 p-7 text-white sm:p-12 md:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent-500">Berberler için</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Dükkanınıza online randevu ve kolay yönetim paneli.</h1>
          <p className="text-lg text-brand-100">Müşterileriniz size özel bağlantınızdan saniyeler içinde randevu alır; siz de randevuları, çalışanları ve kazancı tek yerden takip edersiniz.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/basvuru" className="inline-flex h-12 items-center gap-2 rounded-xl bg-accent-600 px-6 font-semibold text-white hover:bg-[#9a4000]">
              <Store className="size-5" aria-hidden /> İşletmeni ekle
            </Link>
            <Link href="/fiyatlandirma" className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/40 px-6 font-semibold text-white hover:bg-white/10">
              <Tag className="size-5" aria-hidden /> Fiyatlandırma
            </Link>
          </div>
          <p className="text-sm text-brand-100">İlk <b className="text-white">{freeMonths} ay ücretsiz</b> · kurulum 5 dakika · komisyon yok</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-6 text-sm leading-relaxed text-brand-100">
          <p className="text-base font-semibold text-white">Nasıl çalışır?</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>Başvurunuzu yapın, işletmenizi biz ekleyelim.</li>
            <li>Size özel bağlantınızı Instagram'a, WhatsApp'a ve vitrine koyun.</li>
            <li>Müşterileriniz boş saatleri görüp randevu alsın; siz panelden onaylayın.</li>
          </ol>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-900">Dükkanınız için neler var?</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-stone-200/80 bg-white p-5">
              <f.icon className="size-6 text-accent-600" aria-hidden />
              <p className="mt-3 font-semibold text-stone-900">{f.title}</p>
              <p className="mt-1 text-sm text-stone-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200/80 bg-white p-6 text-center sm:p-8">
        <p className="text-sm text-stone-600">
          <b className="text-stone-900">Müşteri misiniz?</b> Berberinizin size gönderdiği bağlantıdan randevu alabilirsiniz.
          Berberiniz henüz Dijital Berber'de değilse ona bizi önerin.
        </p>
      </section>
    </main>
  );
}
