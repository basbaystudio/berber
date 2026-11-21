"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, type ButtonVariant } from "./button";

const control =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-100 aria-[invalid=true]:border-red-500";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "py-2", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-10 pr-8", className)} {...props} />;
}

export function Field({
  label,
  name,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="text-red-600" aria-hidden>
            {" "}*
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="text-sm text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700", className)}>
      <input type="checkbox" className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...props} />
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
