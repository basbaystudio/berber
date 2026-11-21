export type Realm = "CUSTOMER" | "BUSINESS" | "ADMIN";

type RealmConfig = {
  cookie: string;
  /** Oturum ömrü (ms) */
  ttlMs: number;
  /** Kullanıldıkça süre uzasın mı? */
  sliding: boolean;
  loginPath: string;
};

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Her realm için ayrı çerez ve ayrı oturum politikası. */
export const REALMS: Record<Realm, RealmConfig> = {
  CUSTOMER: { cookie: "bp_c", ttlMs: 30 * DAY, sliding: true, loginPath: "/giris" },
  BUSINESS: { cookie: "bp_b", ttlMs: 14 * DAY, sliding: true, loginPath: "/isletme" },
  ADMIN: { cookie: "bp_a", ttlMs: 8 * HOUR, sliding: false, loginPath: "/admin" },
};

export function cookieName(realm: Realm) {
  return (process.env.NODE_ENV === "production" ? "__Host-" : "") + REALMS[realm].cookie;
}
