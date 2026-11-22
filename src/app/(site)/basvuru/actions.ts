"use server";

import { db } from "@/server/db/client";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { getRequestMeta } from "@/server/lib/request";
import { applicationSchema, submitApplication } from "@/server/modules/applications";

export async function submitApplicationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = parseInput(applicationSchema, formToObject(fd));
    await submitApplication(db, input, { ip: (await getRequestMeta()).ip });
    return { status: "success", message: "Başvurunuz alındı." };
  });
}
