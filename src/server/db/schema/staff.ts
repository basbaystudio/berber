import { boolean, check, foreignKey, index, integer, pgTable, primaryKey, smallint, text, time, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { timeOffKindEnum } from "./enums";
import { businesses } from "./business";
import { services } from "./catalog";

const ts = (name: string) => timestamp(name, { withTimezone: true });

/** Çalışan: işletmenin tanımladığı kayıt. Giriş hesabı yoktur. */
export const staff = pgTable(
  "staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    title: text("title"),
    photoKey: text("photo_key"),
    photoUrl: text("photo_url"),
    bio: text("bio"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [unique("staff_business_id_uq").on(t.businessId, t.id), index("staff_business_idx").on(t.businessId)],
);

const staffFk = (t: { businessId: any; staffId: any }, name: string) =>
  foreignKey({ name, columns: [t.businessId, t.staffId], foreignColumns: [staff.businessId, staff.id] }).onDelete("cascade");

/** Haftalık vardiya şablonu (işletme saatlerinden ayrı). */
export const staffShifts = pgTable(
  "staff_shifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    staffId: uuid("staff_id").notNull(),
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (t) => [
    staffFk(t, "staff_shifts_staff_fk"),
    index("staff_shifts_staff_idx").on(t.staffId, t.weekday),
    check("staff_shifts_weekday_ck", sql`${t.weekday} BETWEEN 1 AND 7`),
    check("staff_shifts_range_ck", sql`${t.startTime} < ${t.endTime}`),
  ],
);

/** Tekrarlayan mola. */
export const staffBreaks = pgTable(
  "staff_breaks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    staffId: uuid("staff_id").notNull(),
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (t) => [
    staffFk(t, "staff_breaks_staff_fk"),
    index("staff_breaks_staff_idx").on(t.staffId, t.weekday),
    check("staff_breaks_weekday_ck", sql`${t.weekday} BETWEEN 1 AND 7`),
    check("staff_breaks_range_ck", sql`${t.startTime} < ${t.endTime}`),
  ],
);

/** İzin, rapor, tek seferlik blok. */
export const staffTimeOff = pgTable(
  "staff_time_off",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    staffId: uuid("staff_id").notNull(),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    kind: timeOffKindEnum("kind").notNull().default("LEAVE"),
    note: text("note"),
  },
  (t) => [
    staffFk(t, "staff_time_off_staff_fk"),
    index("staff_time_off_staff_idx").on(t.staffId, t.startsAt),
    check("staff_time_off_range_ck", sql`${t.startsAt} < ${t.endsAt}`),
  ],
);

/** Çalışanın hizmet verme yetkinliği. Bileşik FK'ler çalışan ve hizmetin aynı işletmeye ait olmasını zorlar. */
export const staffServices = pgTable(
  "staff_services",
  {
    businessId: uuid("business_id").notNull(),
    staffId: uuid("staff_id").notNull(),
    serviceId: uuid("service_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.staffId, t.serviceId] }),
    staffFk(t, "staff_services_staff_fk"),
    foreignKey({
      name: "staff_services_service_fk",
      columns: [t.businessId, t.serviceId],
      foreignColumns: [services.businessId, services.id],
    }).onDelete("cascade"),
    index("staff_services_service_idx").on(t.serviceId),
  ],
);
