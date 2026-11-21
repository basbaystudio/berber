import "server-only";
import { headers } from "next/headers";

export type RequestMeta = { ip: string; userAgent: string | null };

/** İstemci IP'si: Vercel'de x-forwarded-for'un ilk değeri platform tarafından ayarlanır. */
export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || h.get("x-real-ip") || "0.0.0.0";
  return { ip, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}
