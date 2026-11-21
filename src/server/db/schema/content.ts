import { check, foreignKey, index, integer, pgTable, primaryKey, smallint, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { reportReasonEnum, reportStatusEnum, reviewStatusEnum } from "./enums";
import { businesses } from "./business";
import { customers, platformAdmins } from "./identity";
import { staff } from "./staff";
import { appointments } from "./booking";

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const portfolioCategories = pgTable(
  "portfolio_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [unique("portfolio_categories_business_id_uq").on(t.businessId, t.id), unique("portfolio_categories_name_uq").on(t.businessId, t.name)],
);

/** Portfolyo fotoğrafı. Görselin kendisi değil, depolama anahtarı ve metadata tutulur. Limit: businesses.photo_count (≤30). */
export const portfolioPhotos = pgTable(
  "portfolio_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id"),
    categoryId: uuid("category_id"),
    storageKey: text("storage_key").notNull(),
    url: text("url").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    mime: text("mime").notNull(),
    caption: text("caption"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ name: "portfolio_photos_staff_fk", columns: [t.businessId, t.staffId], foreignColumns: [staff.businessId, staff.id] }),
    foreignKey({
      name: "portfolio_photos_category_fk",
      columns: [t.businessId, t.categoryId],
      foreignColumns: [portfolioCategories.businessId, portfolioCategories.id],
    }),
    index("portfolio_photos_business_idx").on(t.businessId, t.sortOrder),
  ],
);

/** Yorum: yalnızca tamamlanmış randevu için, randevu başına bir tane. İşletme yanıt verir ama gizleyemez. */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    appointmentId: uuid("appointment_id").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    staffId: uuid("staff_id"),
    rating: smallint("rating").notNull(),
    comment: text("comment"),
    businessReply: text("business_reply"),
    repliedAt: ts("replied_at"),
    status: reviewStatusEnum("status").notNull().default("VISIBLE"),
    removedByAdminId: uuid("removed_by_admin_id").references(() => platformAdmins.id),
    removedAt: ts("removed_at"),
    removalReason: text("removal_reason"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reviews_appointment_uq").on(t.appointmentId),
    foreignKey({
      name: "reviews_appointment_fk",
      columns: [t.businessId, t.appointmentId],
      foreignColumns: [appointments.businessId, appointments.id],
    }).onDelete("cascade"),
    index("reviews_business_idx").on(t.businessId, t.createdAt),
    check("reviews_rating_ck", sql`${t.rating} BETWEEN 1 AND 5`),
  ],
);

/** İşletmenin yorum şikâyeti. Admin inceler: kaldırır ya da reddeder. */
export const reviewReports = pgTable(
  "review_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    reason: reportReasonEnum("reason").notNull(),
    note: text("note"),
    status: reportStatusEnum("status").notNull().default("OPEN"),
    resolvedByAdminId: uuid("resolved_by_admin_id").references(() => platformAdmins.id),
    resolvedAt: ts("resolved_at"),
    adminNote: text("admin_note"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("review_reports_open_uq").on(t.reviewId).where(sql`${t.status} = 'OPEN'`),
    index("review_reports_status_idx").on(t.status, t.createdAt),
  ],
);

export const favorites = pgTable(
  "favorites",
  {
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.customerId, t.businessId] })],
);

