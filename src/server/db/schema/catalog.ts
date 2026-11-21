import { boolean, check, foreignKey, index, integer, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { businesses } from "./business";
import { serviceTypes } from "./reference";
import { staff } from "./staff";

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    serviceTypeId: uuid("service_type_id").references(() => serviceTypes.id),
    name: text("name").notNull(),
    description: text("description"),
    priceKurus: integer("price_kurus").notNull(),
    durationMin: integer("duration_min").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [
    unique("services_business_id_uq").on(t.businessId, t.id),
    index("services_business_idx").on(t.businessId),
    check("services_price_ck", sql`${t.priceKurus} >= 0`),
    check("services_duration_ck", sql`${t.durationMin} BETWEEN 5 AND 600 AND ${t.durationMin} % 5 = 0`),
  ],
);

export const packages = pgTable(
  "packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    priceKurus: integer("price_kurus").notNull(),
    durationMin: integer("duration_min").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [
    unique("packages_business_id_uq").on(t.businessId, t.id),
    check("packages_price_ck", sql`${t.priceKurus} >= 0`),
    check("packages_duration_ck", sql`${t.durationMin} BETWEEN 5 AND 600 AND ${t.durationMin} % 5 = 0`),
  ],
);

export const packageItems = pgTable(
  "package_items",
  {
    businessId: uuid("business_id").notNull(),
    packageId: uuid("package_id").notNull(),
    serviceId: uuid("service_id").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.packageId, t.serviceId] }),
    foreignKey({ name: "package_items_package_fk", columns: [t.businessId, t.packageId], foreignColumns: [packages.businessId, packages.id] }).onDelete("cascade"),
    foreignKey({ name: "package_items_service_fk", columns: [t.businessId, t.serviceId], foreignColumns: [services.businessId, services.id] }).onDelete("cascade"),
  ],
);

/** Paketi verebilecek çalışanlar (paketin tamamını tek çalışan yapar). */
export const packageStaff = pgTable(
  "package_staff",
  {
    businessId: uuid("business_id").notNull(),
    packageId: uuid("package_id").notNull(),
    staffId: uuid("staff_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.packageId, t.staffId] }),
    foreignKey({ name: "package_staff_package_fk", columns: [t.businessId, t.packageId], foreignColumns: [packages.businessId, packages.id] }).onDelete("cascade"),
    foreignKey({ name: "package_staff_staff_fk", columns: [t.businessId, t.staffId], foreignColumns: [staff.businessId, staff.id] }).onDelete("cascade"),
  ],
);
