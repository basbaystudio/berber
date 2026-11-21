"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import type { ActionState } from "@/server/lib/action";

/**
 * Server action'ı form gönderimiyle çalıştırır. React'in varsayılan "işlem sonrası formu sıfırlama"
 * davranışını engeller; böylece doğrulama hatasında kullanıcının girdiği değerler kaybolmaz.
 */
export function useFormAction<T>(
  action: (prev: ActionState<T>, fd: FormData) => Promise<ActionState<T>>,
  opts: { resetOnSuccess?: boolean } = {},
) {
  const [state, dispatch, pending] = useActionState(action, { status: "idle" } as ActionState<T>);
  const formRef = useRef<HTMLFormElement | null>(null);
  useEffect(() => {
    if (opts.resetOnSuccess && state.status === "success") formRef.current?.reset();
  }, [state, opts.resetOnSuccess]);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    formRef.current = e.currentTarget;
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  return { state, pending, onSubmit, fieldErrors };
}

/** Parametresiz bir server action'ı (buton) çalıştırır. */
export function useButtonAction<T>(action: () => Promise<ActionState<T>>) {
  const [state, dispatch, pending] = useActionState(async () => action(), { status: "idle" } as ActionState<T>);
  const run = () => startTransition(() => dispatch());
  return { state, pending, run };
}
