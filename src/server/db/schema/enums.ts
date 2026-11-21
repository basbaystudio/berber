import { pgEnum } from "drizzle-orm/pg-core";

export const realmEnum = pgEnum("realm", ["CUSTOMER", "BUSINESS", "ADMIN"]);
export const businessStatusEnum = pgEnum("business_status", ["DRAFT", "ACTIVE", "SUSPENDED"]);
export const exceptionKindEnum = pgEnum("exception_kind", ["CLOSED", "CUSTOM_HOURS"]);
export const exceptionReasonEnum = pgEnum("exception_reason", ["HOLIDAY", "SPECIAL", "VACATION", "OTHER"]);
export const timeOffKindEnum = pgEnum("time_off_kind", ["LEAVE", "SICK", "BLOCK"]);
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
]);
export const appointmentSourceEnum = pgEnum("appointment_source", ["ONLINE", "PANEL"]);
export const cancelReasonEnum = pgEnum("cancel_reason", [
  "CUSTOMER",
  "BUSINESS",
  "NOT_CONFIRMED_IN_TIME",
  "ADMIN",
]);
export const reviewStatusEnum = pgEnum("review_status", ["VISIBLE", "REMOVED"]);
export const reportReasonEnum = pgEnum("report_reason", ["SPAM", "INSULT", "MISLEADING", "OTHER"]);
export const reportStatusEnum = pgEnum("report_status", ["OPEN", "REJECTED", "REMOVED"]);
export const authTokenPurposeEnum = pgEnum("auth_token_purpose", ["EMAIL_VERIFY", "PASSWORD_RESET"]);
export const notificationStatusEnum = pgEnum("notification_status", ["QUEUED", "SENT", "FAILED"]);
export const paymentMethodEnum = pgEnum("payment_method", ["CARD", "BANK_TRANSFER", "CASH", "OTHER"]);
export const paymentStatusEnum = pgEnum("payment_status", ["SUCCEEDED", "REFUNDED"]);
