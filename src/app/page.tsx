import { Scissors } from "lucide-react";

/** Pazaryeri ana sayfası Aşama 5'te geliştirilecek. */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-slate-900 text-white">
        <Scissors className="size-7" aria-hidden />
      </span>
      <h1 className="text-3xl font-semibold tracking-tight">Berber Randevu</h1>
      <p className="text-slate-600">
        Yakınındaki berberleri keşfet, boş saatleri anında gör ve online randevu al. Pazaryeri çok yakında burada.
      </p>
    </main>
  );
}
