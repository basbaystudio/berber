import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { businessStatusEnum, exceptionKindEnum, exceptionReasonEnum } from "./enums";
import { districts, provinces } from "./reference";

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const MAX_PORTFOLIO_PHOTOS = 30;

export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    phone: text("phone").notNull(),
    addressLine: text("address_line").notNull(),
    provinceId: smallint("province_id")
      .notNull()
      .references(() => provinces.id),
    districtId: integer("district_id")
      .notNull()
      .references(() => districts.id),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    logoKey: text("logo_key"),
    logoUrl: text("logo_url"),
    coverKey: text("cover_key"),
    coverUrl: text("cover_url"),
    status: businessStatusEnum("status").notNull().default("DRAFT"),
    isPublished: boolean("is_published").notNull().default(false),
    publishedAt: ts("published_at"),
    isFeatured: boolean("is_featured").notNull().default(false),
    featuredRank: integer("featured_rank"),
    photoCount: integer("photo_count").notNull().default(0),
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 }).notNull().default("0"),
    ratingCount: integer("rating_count").notNull().default(0),
    minPriceKurus: integer("min_price_kurus"),
    lastPanelActivityAt: ts("last_panel_activity_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("businesses_slug_uq").on(t.slug),
    index("businesses_location_idx").on(t.provinceId, t.districtId),
    check("businesses_photo_count_ck", sql`${t.photoCount} BETWEEN 0 AND 30`),
    check(
      "businesses_coords_ck",
      sql`(${t.latitude} IS NULL AND ${t.longitude} IS NULL) OR (${t.latitude} BETWEEN -90 AND 90 AND ${t.longitude} BETWEEN -180 AND 180)`,
    ),
    // Yayındaki işletme aktif olmak zorunda
    check("businesses_published_active_ck", sql`NOT ${t.isPublished} OR ${t.status} = 'ACTIVE'`),
  ],
);

export const businessSettings = pgTable(
  "business_settings",
  {
    businessId: uuid("business_id")
      .primaryKey()
      .references(() => businesses.id, { onDelete: "cascade" }),
    slotIntervalMin: smallint("slot_interval_min").notNull().default(15),
    minLeadMin: integer("min_lead_min").notNull().default(60),
    maxAdvanceDays: smallint("max_advance_days").notNull().default(30),
    bufferMin: smallint("buffer_min").notNull().default(0),
    tempClosedUntil: ts("temp_closed_until"),
    tempClosedNote: text("temp_closed_note"),
  },
  (t) => [
    check("bs_slot_ck", sql`${t.slotIntervalMin} IN (5, 10, 15, 20, 30, 60)`),
    check("bs_lead_ck", sql`${t.minLeadMin} BETWEEN 0 AND 10080`),
    check("bs_adv_ck", sql`${t.maxAdvanceDays} BETWEEN 1 AND 365`),
    check("bs_buffer_ck", sql`${t.bufferMin} BETWEEN 0 AND 120`),
  ],
);

/** Haftalık çalışma saatleri. Gün başına birden çok satır = birden çok aralık. Satır yok = kapalı. weekday: 1=Pzt … 7=Paz */
export const businessHours = pgTable(
  "business_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (t) => [
    index("business_hours_business_idx").on(t.businessId, t.weekday),
    check("business_hours_weekday_ck", sql`${t.weekday} BETWEEN 1 AND 7`),
    check("business_hours_range_ck", sql`${t.startTime} < ${t.endTime}`),
  ],
);

/** Tarih bazlı istisna: tatil, özel gün, izin. */
export const businessExceptions = pgTable(
  "business_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    kind: exceptionKindEnum("kind").notNull(),
    reason: exceptionReasonEnum("reason").notNull().default("OTHER"),
    note: text("note"),
  },
  (t) => [unique("business_exceptions_day_uq").on(t.businessId, t.date)],
);

export const businessExceptionRanges = pgTable(
  "business_exception_ranges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    exceptionId: uuid("exception_id")
      .notNull()
      .references(() => businessExceptions.id, { onDelete: "cascade" }),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (t) => [check("ber_range_ck", sql`${t.startTime} < ${t.endTime}`)],
);

