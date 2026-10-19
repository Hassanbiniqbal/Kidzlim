import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'resendConfirmation' BEFORE 'deliverDigital';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'syncGelatoStatus';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'sendShippingNotification';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'resendConfirmation' BEFORE 'deliverDigital';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'syncGelatoStatus';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'sendShippingNotification';
  ALTER TABLE "orders" ADD COLUMN "shipping_notified_at" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "needs_attention" boolean DEFAULT false;
  ALTER TABLE "orders" ADD COLUMN "attention_reason" varchar;
  ALTER TABLE "orders" ADD COLUMN "refunded_amount_a_e_d" numeric;
  CREATE INDEX "orders_needs_attention_idx" ON "orders" USING btree ("needs_attention");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'sendOrderConfirmation', 'deliverDigital', 'resendDownload', 'submitGelatoOrder');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'sendOrderConfirmation', 'deliverDigital', 'resendDownload', 'submitGelatoOrder');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "orders_needs_attention_idx";
  ALTER TABLE "orders" DROP COLUMN "shipping_notified_at";
  ALTER TABLE "orders" DROP COLUMN "needs_attention";
  ALTER TABLE "orders" DROP COLUMN "attention_reason";
  ALTER TABLE "orders" DROP COLUMN "refunded_amount_a_e_d";`)
}
