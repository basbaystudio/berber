import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/60",
  secondary: "bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-900/60",
  outline: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:text-slate-400",
  ghost: "text-slate-700 hover:bg-slate-100 disabled:text-slate-400",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/60",
  dangerOutline: "border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:text-red-300",
} as const;

const sizes = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
} as const;

export type ButtonVariant = keyof typeof variants;
type Common = { variant?: ButtonVariant; size?: keyof typeof sizes };

export function buttonClass({ variant = "primary", size = "md" }: Common = {}, extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed whitespace-nowrap",
    variants[variant],
    sizes[size],
    extra,
  );
}

export function Button({ variant, size, className, type = "button", ...props }: ComponentProps<"button"> & Common) {
  return <button type={type} className={buttonClass({ variant, size }, className)} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & Common) {
  return <Link className={buttonClass({ variant, size }, className)} {...props} />;
}
