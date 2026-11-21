const MAP: Record<string, string> = { ç: "c", ğ: "g", ı: "i", i: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** Türkçe karakterleri dönüştürerek URL uyumlu slug üretir. */
export function slugify(input: string): string {
  return input
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıiöşüâîû]/g, (ch) => MAP[ch] ?? ch)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
