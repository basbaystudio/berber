"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, type ButtonVariant } from "./button";

const control =
  "block w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-4 focus:ring-stone-200/60 disabled:bg-stone-50 disabled:text-stone-500 aria-[invalid=true]:border-red-400";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "py-2", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-10 pr-8", className)} {...props} />;
}

/**
 * Etiketli form alanı. `id` verilmezse alanın id'si `name` kabul edilir (etiket ile alan eşleşmeli).
 * `group`: birden çok kontrolden oluşan alanlar (işaret kutusu listesi vb.) için role="group" + aria-labelledby.
 */
export function Field({
  label,
  name,
  id,
  group,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  name: string;
  id?: string;
  group?: boolean;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const labelContent = (
    <>
      {label}
      {required && (
        <span className="text-stone-400" aria-hidden>
          {" "}*
        </span>
      )}
    </>
  );
  return (
    <div className={cn("space-y-1.5", className)} {...(group ? { role: "group", "aria-labelledby": `${name}-label` } : {})}>
      {group ? (
        <span id={`${name}-label`} className="block text-sm font-medium text-stone-700">
          {labelContent}
        </span>
      ) : (
        <label htmlFor={id ?? name} className="block text-sm font-medium text-stone-700">
          {labelContent}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${name}-error`} className="text-sm text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-stone-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-sm text-stone-700", className)}>
      <input type="checkbox" className="size-4 rounded border-stone-300 accent-stone-900" {...props} />
      {label}
    </label>
  );
}

/** Form gönderilirken devre dışı kalan ve yükleniyor gösteren buton. */
export function SubmitButton({
  children,
  pendingText,
  variant,
  className,
  size,
  pending: pendingProp,
  ...rest
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** useFormAction ile kullanılırken bekleme durumu buradan verilir. */
  pending?: boolean;
} & Omit<ComponentProps<"button">, "type">) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending || rest.disabled} className={className} {...rest}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? (pendingText ?? "Kaydediliyor…") : children}
    </Button>
  );
}
