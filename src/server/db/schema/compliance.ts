import { boolean, check, index, integer, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { businesses } from "./business";
import { businessUsers, platformAdmins } from "./identity";

const ts = (name: string) => timestamp(name, { withTimezone: true });

/** İşletmeden istenen belge türleri (ör. vergi levhası, işyeri açma ruhsatı). Admin yönetir. */
export const documentTypes = pgTable("document_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  isRequired: boolean("is_required").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

/**
 * İşletmenin yüklediği belge (tür başına güncel bir kayıt; yeniden yükleme yeniden incelemeye düşer).
 * Dosyalar herkese açık sunulmaz; yalnızca o işletme ve yönetici yetkili adresten indirir.
 */
export const businessDocuments = pgTable(
  "business_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    typeId: uuid("type_id")
      .notNull()
      .references(() => documentTypes.id),
    fileKey: text("file_key").notNull(),
    fileUrl: text("file_url").notNull(),
    fileName: text("file_name").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    status: text("status").notNull().default("PENDING"),
    reviewNote: text("review_note"),
    reviewedByAdminId: uuid("reviewed_by_admin_id").references(() => platformAdmins.id),
    reviewedAt: ts("reviewed_at"),
    uploadedAt: ts("uploaded_at").notNull().defaultNow(),
  },
  (t) => [
    unique("business_documents_type_uq").on(t.businessId, t.typeId),
    index("business_documents_status_idx").on(t.status, t.uploadedAt),
    check("business_documents_status_ck", sql`${t.status} IN ('PENDING', 'APPROVED', 'REJECTED')`),
  ],
);

/** Sözleşme (ör. Hizmet Sözleşmesi, KVKK Aydınlatma Metni). İçerik sürümlerde tutulur. */
export const contracts = pgTable("contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/** Yayınlanan her güncelleme yeni sürümdür; eski sürümler ve onaylar değişmez (hukuki kayıt). */
export const contractVersions = pgTable(
  "contract_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: text("content").notNull(),
    changeNote: text("change_note"),
    publishedAt: ts("published_at").notNull().defaultNow(),
    publishedByAdminId: uuid("published_by_admin_id").references(() => platformAdmins.id),
  },
  (t) => [unique("contract_versions_uq").on(t.contractId, t.version)],
);

/** İşletmenin bir sözleşme sürümünü onayı (tarih, IP ve tarayıcı bilgisiyle). */
export const contractAcceptances = pgTable(
  "contract_acceptances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => contractVersions.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => businessUsers.id, { onDelete: "set null" }),
    acceptedAt: ts("accepted_at").notNull().defaultNow(),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [uniqueIndex("contract_acceptances_uq").on(t.versionId, t.businessId)],
);

/** İşletme panelindeki bildirim kutusu. */
export const businessInbox = pgTable(
  "business_inbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: ts("read_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("business_inbox_business_idx").on(t.businessId, t.createdAt), index("business_inbox_unread_idx").on(t.businessId).where(sql`${t.readAt} IS NULL`)],
);
