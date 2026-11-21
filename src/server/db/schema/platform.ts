import { boolean, check, date, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { notificationStatusEnum, paymentMethodEnum, paymentStatusEnum, realmEnum } from "./enums";
import { businesses } from "./business";
import { platformAdmins } from "./identity";
import { appointments } from "./booking";

const ts = (name: string) => timestamp(name, { withTimezone: true });

/** Kodda sabitlenmeyen platform ayarları (güven puanı ağırlıkları, onay süresi vb.). */
export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedByAdminId: uuid("updated_by_admin_id").references(() => platformAdmins.id),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorRealm: realmEnum("actor_realm"),
    actorId: uuid("actor_id"),
    businessId: uuid("business_id"),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    meta: jsonb("meta"),
    ip: text("ip"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt), index("audit_logs_business_idx").on(t.businessId, t.createdAt)],
);

/** E-posta bildirim kuyruğu ve kaydı. */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: text("channel").notNull().default("EMAIL"),
    to: text("to").notNull(),
    template: text("template").notNull(),
    payload: jsonb("payload").notNull(),
    status: notificationStatusEnum("status").notNull().default("QUEUED"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    appointmentId: uuid("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
    businessId: uuid("business_id").references(() => businesses.id, { onDelete: "set null" }),
    /** Aynı olay için ikinci kez bildirim gönderilmesini engeller (ör. "gecikme:<işletme>:<alıcı>:<son ödenen gün>"). */
    dedupeKey: text("dedupe_key"),
    sentAt: ts("sent_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_status_idx").on(t.status, t.createdAt), uniqueIndex("notifications_dedupe_uq").on(t.dedupeKey)],
);

/**
 * Abonelik paketleri (ör. Standart, Premium Plus). Admin yönetir; kodda sabit değildir.
 * `capabilities`: ileride pakete özel yetkiler (ör. öne çıkma, ek fotoğraf hakkı) için ayrılmış alan.
 */
export const subscriptionPlans = pgTable(
  "subscription_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    monthlyPriceKurus: integer("monthly_price_kurus").notNull(),
    highlights: jsonb("highlights").$type<string[]>().notNull().default([]),
    capabilities: jsonb("capabilities").$type<Record<string, unknown>>().notNull().default({}),
    isActive: boolean("is_active").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subscription_plans_code_uq").on(t.code),
    uniqueIndex("subscription_plans_default_uq").on(t.isDefault).where(sql`${t.isDefault}`),
    check("subscription_plans_price_ck", sql`${t.monthlyPriceKurus} >= 0`),
  ],
);

/**
 * İşletmenin aboneliği (işletme başına bir satır). Durum saklanmaz, tarihlerden hesaplanır:
 * ücretlendirme kapalı → ücretsiz dönem; trial_ends_on ≥ bugün → deneme; paid_through ≥ bugün → ödendi; aksi halde gecikmiş.
 * Deneme süresi (ay) işletme oluşturulurken belirlenir; başlangıcı ücretlendirme açıldığında (ya da sonrasında oluşturulmada) atanır.
 */
export const businessSubscriptions = pgTable(
  "business_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => subscriptionPlans.id),
    /** Aboneliğe kilitlenen aylık ücret (paket fiyatı sonradan değişse bile korunur). */
    monthlyFeeKurus: integer("monthly_fee_kurus").notNull(),
    trialMonths: integer("trial_months").notNull(),
    trialStartsOn: date("trial_starts_on"),
    trialEndsOn: date("trial_ends_on"),
    paidThrough: date("paid_through"),
    isEarlyAdopter: boolean("is_early_adopter").notNull().default(false),
    /*
     * Otomatik yenilenen kart aboneliği (ödeme sağlayıcısı bağlandığında doldurulur).
     * Kart bilgisi ASLA bu veritabanında tutulmaz; kart sağlayıcının kasasında saklanır.
     * Burada yalnızca sağlayıcının referansları ve gösterim için kart markası / son 4 hane bulunur.
     */
    paymentProvider: text("payment_provider"),
    providerCustomerRef: text("provider_customer_ref"),
    providerSubscriptionRef: text("provider_subscription_ref"),
    cardBrand: text("card_brand"),
    cardLast4: text("card_last4"),
    autoRenew: boolean("auto_renew").notNull().default(false),
    /** İşletmenin seçtiği ödeme yöntemi: CARD (otomatik kart çekimi) ya da BANK_TRANSFER (havale/EFT, admin kaydeder). */
    preferredMethod: text("preferred_method").notNull().default("CARD"),
    cancelledAt: ts("cancelled_at"),
    note: text("note"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("business_subscriptions_business_uq").on(t.businessId),
    uniqueIndex("business_subscriptions_provider_sub_uq").on(t.paymentProvider, t.providerSubscriptionRef).where(sql`${t.providerSubscriptionRef} IS NOT NULL`),
    check("business_subscriptions_method_ck", sql`${t.preferredMethod} IN ('CARD', 'BANK_TRANSFER')`),
    check("business_subscriptions_last4_ck", sql`${t.cardLast4} IS NULL OR ${t.cardLast4} ~ '^[0-9]{4}$'`),
    check("business_subscriptions_fee_ck", sql`${t.monthlyFeeKurus} >= 0`),
    check("business_subscriptions_trial_ck", sql`${t.trialMonths} BETWEEN 0 AND 36`),
  ],
);

/**
 * Abonelik ödemeleri. Kartla online ödeme (ileride iyzico/PayTR vb.) ve admin'in elle kaydettiği ödemeler aynı tabloda.
 * provider_ref: ödeme sağlayıcısının işlem numarası (aynı işlem iki kez kaydedilemez).
 */
export const subscriptionPayments = pgTable(
  "subscription_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => businessSubscriptions.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").references(() => subscriptionPlans.id),
    amountKurus: integer("amount_kurus").notNull(),
    months: integer("months").notNull(),
    coversFrom: date("covers_from").notNull(),
    coversTo: date("covers_to").notNull(),
    method: paymentMethodEnum("method").notNull(),
    status: paymentStatusEnum("status").notNull().default("SUCCEEDED"),
    provider: text("provider"),
    providerRef: text("provider_ref"),
    paidAt: ts("paid_at").notNull().defaultNow(),
    note: text("note"),
    recordedByAdminId: uuid("recorded_by_admin_id").references(() => platformAdmins.id),
    /** Admin'in yüklediği PDF fatura. Herkese açık bağlantı verilmez; yalnızca yetkili oturumla indirilir. */
    invoiceKey: text("invoice_key"),
    invoiceUrl: text("invoice_url"),
    invoiceFileName: text("invoice_file_name"),
    invoiceUploadedAt: ts("invoice_uploaded_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("subscription_payments_business_idx").on(t.businessId, t.paidAt),
    index("subscription_payments_invoice_pending_idx").on(t.paidAt).where(sql`${t.invoiceKey} IS NULL`),
    uniqueIndex("subscription_payments_provider_ref_uq").on(t.provider, t.providerRef).where(sql`${t.providerRef} IS NOT NULL`),
    check("subscription_payments_amount_ck", sql`${t.amountKurus} >= 0`),
    check("subscription_payments_months_ck", sql`${t.months} BETWEEN 1 AND 36`),
    check("subscription_payments_range_ck", sql`${t.coversFrom} < ${t.coversTo}`),
  ],
);

/** Ana sayfa bannerları (admin yönetir). */
export const banners = pgTable(
  "banners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    imageKey: text("image_key").notNull(),
    imageUrl: text("image_url").notNull(),
    imageWidth: integer("image_width").notNull(),
    imageHeight: integer("image_height").notNull(),
    linkUrl: text("link_url"),
    buttonText: text("button_text"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    startsAt: ts("starts_at"),
    endsAt: ts("ends_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("banners_active_idx").on(t.isActive, t.sortOrder),
    check("banners_range_ck", sql`${t.startsAt} IS NULL OR ${t.endsAt} IS NULL OR ${t.startsAt} < ${t.endsAt}`),
  ],
);

/** İşletme güven puanı (anlık) ve günlük geçmişi. */
export const businessTrustScores = pgTable("business_trust_scores", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  score: numeric("score", { precision: 5, scale: 2 }).notNull(),
  sampleSize: integer("sample_size").notNull(),
  components: jsonb("components").notNull(),
  computedAt: ts("computed_at").notNull().defaultNow(),
});

export const businessTrustHistory = pgTable(
  "business_trust_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    score: numeric("score", { precision: 5, scale: 2 }).notNull(),
    components: jsonb("components").notNull(),
    computedOn: date("computed_on").notNull(),
  },
  (t) => [index("business_trust_history_idx").on(t.businessId, t.computedOn)],
);
