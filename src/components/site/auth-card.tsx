export function AuthCard({ title, description, children }: { title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-10 sm:py-16">
      <div className="rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-10">
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">{title}</h1>
        {description && <div className="mb-6 mt-1 text-sm text-stone-500">{description}</div>}
        {children}
      </div>
    </main>
  );
}
