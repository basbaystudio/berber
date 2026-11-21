import { boolean, date, integer, pgTable, smallint, text, uniqueIndex, uuid, index } from "drizzle-orm/pg-core";

export const provinces = pgTable("provinces", {
  id: smallint("id").primaryKey(), // plaka kodu
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});

export const districts = pgTable(
  "districts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    provinceId: smallint("province_id")
      .notNull()
      .references(() => provinces.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
  },
  (t) => [uniqueIndex("districts_province_slug_uq").on(t.provinceId, t.slug), index("districts_province_idx").on(t.provinceId)],
);

/** Platform genelindeki hizmet türleri (pazaryeri filtresi). Admin yönetir. */
export const serviceTypes = pgTable("service_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

/** Resmî tatiller (admin yönetir). İşletme bu günler için açık/kapalı kararını kendisi verir. */
export const publicHolidays = pgTable("public_holidays", {
  date: date("date").primaryKey(),
  name: text("name").notNull(),
  isHalfDay: boolean("is_half_day").notNull().default(false),
});
