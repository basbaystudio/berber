import { check, foreignKey, index, integer, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { appointmentSourceEnum, appointmentStatusEnum, cancelReasonEnum, realmEnum } from "./enums";
import { businesses } from "./business";
import { customers } from "./identity";
import { staff } from "./staff";
import { packages, services } from "./catalog";

const ts = (name: string) => timestamp(name, { withTimezone: true });

/**
 * İşletmeye özel müşteri kaydı (CRM). customer_id NULL ise işletmenin panelden girdiği hesapsız müşteridir.
 * İşletme müşteri bilgisine yalnızca bu tablo üzerinden erişir.
 */
export const businessCustomers = pgTable(
  "business_customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    phone: text("phone"),
    email: text("email"),
    notes: text("notes"),
    firstVisitAt: ts("first_visit_at"),
    lastVisitAt: ts("last_visit_at"),
    visitCount: integer("visit_count").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("business_customers_business_id_uq").on(t.businessId, t.id),
    uniqueIndex("business_customers_account_uq").on(t.businessId, t.customerId).where(sql`${t.customerId} IS NOT NULL`),
    index("business_customers_phone_idx").on(t.businessId, t.phone),
  ],
);

/**
 * Randevu. Çakışma koruması: migration'daki EXCLUDE kısıtı (staff_id, [starts_at, blocked_until)) aktif durumlarda örtüşmeyi engeller.
 */
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    staffId: uuid("staff_id").notNull(),
    businessCustomerId: uuid("business_customer_id").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    blockedUntil: ts("blocked_until").notNull(),
    status: appointmentStatusEnum("status").notNull().default("PENDING"),
    source: appointmentSourceEnum("source").notNull(),
    confirmDeadline: ts("confirm_deadline"),
    confirmedAt: ts("confirmed_at"),
    totalKurus: integer("total_kurus").notNull(),
    customerNote: text("customer_note"),
    internalNote: text("internal_note"),
    cancelledAt: ts("cancelled_at"),
    cancelReason: cancelReasonEnum("cancel_reason"),
    cancelNote: text("cancel_note"),
    idempotencyKey: text("idempotency_key"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("appointments_business_id_uq").on(t.businessId, t.id),
    foreignKey({ name: "appointments_staff_fk", columns: [t.businessId, t.staffId], foreignColumns: [staff.businessId, staff.id] }),
    foreignKey({
      name: "appointments_bcustomer_fk",
      columns: [t.businessId, t.businessCustomerId],
      foreignColumns: [businessCustomers.businessId, businessCustomers.id],
    }),
    uniqueIndex("appointments_idempotency_uq").on(t.idempotencyKey).where(sql`${t.idempotencyKey} IS NOT NULL`),
    index("appointments_business_start_idx").on(t.businessId, t.startsAt),
    index("appointments_staff_start_idx").on(t.staffId, t.startsAt),
    index("appointments_customer_idx").on(t.customerId, t.startsAt),
    index("appointments_pending_deadline_idx").on(t.confirmDeadline).where(sql`${t.status} = 'PENDING'`),
    check("appointments_range_ck", sql`${t.startsAt} < ${t.endsAt} AND ${t.endsAt} <= ${t.blockedUntil}`),
    check("appointments_total_ck", sql`${t.totalKurus} >= 0`),
    check("appointments_online_customer_ck", sql`${t.source} <> 'ONLINE' OR ${t.customerId} IS NOT NULL`),
    check("appointments_cancel_ck", sql`(${t.status} = 'CANCELLED') = (${t.cancelledAt} IS NOT NULL)`),
  ],
);

/** Randevudaki hizmet/paket kalemleri (ad, fiyat, süre anlık görüntüsü). */
export const appointmentItems = pgTable(
  "appointment_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
    packageId: uuid("package_id").references(() => packages.id, { onDelete: "set null" }),
    nameSnapshot: text("name_snapshot").notNull(),
    priceSnapshotKurus: integer("price_snapshot_kurus").notNull(),
    durationSnapshotMin: integer("duration_snapshot_min").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("appointment_items_appt_idx").on(t.appointmentId)],
);

/** Durum değişikliği denetim izi (güven puanı hesaplamasında da kullanılır). */
export const appointmentEvents = pgTable(
  "appointment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    businessId: uuid("business_id").notNull(),
    fromStatus: appointmentStatusEnum("from_status"),
    toStatus: appointmentStatusEnum("to_status").notNull(),
    actorRealm: realmEnum("actor_realm"),
    actorId: uuid("actor_id"),
    note: text("note"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("appointment_events_appt_idx").on(t.appointmentId), index("appointment_events_business_idx").on(t.businessId, t.createdAt)],
);
