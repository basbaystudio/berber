import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authTokenPurposeEnum, realmEnum } from "./enums";
import { businesses } from "./business";

const ts = (name: string) => timestamp(name, { withTimezone: true });

/** Platform sahibi. Ayrı tablo: başka bir realm'den yetki yükseltmek mümkün olmasın. */
export const platformAdmins = pgTable(
  "platform_admins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: ts("last_login_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("platform_admins_email_uq").on(sql`lower(${t.email})`)],
);

/** İşletme hesabı. Yalnızca admin oluşturur. Çalışan girişi yoktur. */
export const businessUsers = pgTable(
  "business_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    login: text("login").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    mustChangePassword: boolean("must_change_password").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: ts("last_login_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("business_users_login_uq").on(sql`lower(${t.login})`),
    index("business_users_business_idx").on(t.businessId),
  ],
);

/** Müşteri hesabı: e-posta + şifre, e-posta doğrulamalı. */
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerifiedAt: ts("email_verified_at"),
    phone: text("phone").notNull(),
    passwordHash: text("password_hash").notNull(),
    kvkkConsentAt: ts("kvkk_consent_at").notNull(),
    marketingConsent: boolean("marketing_consent").notNull().default(false),
    lastLoginAt: ts("last_login_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [uniqueIndex("customers_email_uq").on(sql`lower(${t.email})`)],
);

/** Oturumlar. id = token'ın SHA-256 hash'i; token'ın kendisi saklanmaz. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    realm: realmEnum("realm").notNull(),
    principalId: uuid("principal_id").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_principal_idx").on(t.realm, t.principalId), index("sessions_expires_idx").on(t.expiresAt)],
);

/** E-posta doğrulama ve şifre sıfırlama token'ları (yalnızca hash). */
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: text("id").primaryKey(),
    realm: realmEnum("realm").notNull(),
    principalId: uuid("principal_id").notNull(),
    purpose: authTokenPurposeEnum("purpose").notNull(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("auth_tokens_principal_idx").on(t.realm, t.principalId, t.purpose)],
);

/** Sabit pencereli rate limit sayaçları (Redis gerektirmez). */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    windowEndsAt: ts("window_ends_at").notNull(),
  },
  (t) => [index("rate_limits_window_idx").on(t.windowEndsAt)],
);
