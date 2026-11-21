"use client";

import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, SubmitButton } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  identifierLabel: string;
  identifierType?: "email" | "text";
  identifierAutoComplete?: string;
  hidden?: Record<string, string>;
};

export function LoginForm({ action, identifierLabel, identifierType = "text", identifierAutoComplete = "username", hidden }: Props) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      <Field label={identifierLabel} name="identifier" error={fe?.identifier} required>
        <Input
          id="identifier"
          name="identifier"
          type={identifierType}
          autoComplete={identifierAutoComplete}
          autoCapitalize="none"
          spellCheck={false}
          required
          aria-invalid={!!fe?.identifier}
        />
      </Field>
      <Field label="Şifre" name="password" error={fe?.password} required>
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={!!fe?.password} />
      </Field>
      <SubmitButton className="w-full" pending={pending} pendingText="Giriş yapılıyor…">
        Giriş yap
      </SubmitButton>
    </form>
  );
}
