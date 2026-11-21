import { date, index, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { notificationStatusEnum, paymentMethodEnum, realmEnum, subscriptionStatusEnum } from "./enums";
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
    sentAt: ts("sent_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_status_idx").on(t.status, t.createdAt)],
);

/** Platformun işletmeden aldığı abonelik (online tahsilat yok; admin manuel kaydeder). */
export const businessSubscriptions = pgTable(
  "business_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    planName: text("plan_name").notNull(),
    monthlyFeeKurus: integer("monthly_fee_kurus").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on"),
    status: subscriptionStatusEnum("status").notNull().default("ACTIVE"),
    note: text("note"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("business_subscriptions_business_idx").on(t.businessId)],
);

export const subscriptionPayments = pgTable(
  "subscription_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(() => businessSubscriptions.id, { onDelete: "set null" }),
    amountKurus: integer("amount_kurus").notNull(),
    paidOn: date("paid_on").notNull(),
    method: paymentMethodEnum("method").notNull(),
    periodLabel: text("period_label"),
    note: text("note"),
    recordedByAdminId: uuid("recorded_by_admin_id").references(() => platformAdmins.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("subscription_payments_business_idx").on(t.businessId, t.paidOn)],
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
