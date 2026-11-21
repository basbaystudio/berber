import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-stone-900 text-white hover:bg-stone-800 disabled:bg-stone-900/40",
  secondary: "bg-stone-100 text-stone-800 hover:bg-stone-200 disabled:text-stone-400",
  outline: "border border-stone-200 bg-white text-stone-800 hover:border-stone-300 hover:bg-stone-50 disabled:text-stone-400",
  ghost: "text-stone-700 hover:bg-stone-100 disabled:text-stone-400",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/60",
  dangerOutline: "border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:text-red-300",
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
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:cursor-not-allowed whitespace-nowrap",
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
