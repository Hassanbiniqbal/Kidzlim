import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_protected_files_kind" AS ENUM('digital', 'print');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'sendOrderConfirmation', 'deliverDigital', 'resendDownload', 'submitGelatoOrder');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'sendOrderConfirmation', 'deliverDigital', 'resendDownload', 'submitGelatoOrder');
  CREATE TABLE "protected_files" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_protected_files_kind" DEFAULT 'digital' NOT NULL,
  	"page_count" numeric,
  	"page_size" varchar,
  	"has_bleed" boolean,
  	"checks" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );
  
  CREATE TABLE "payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"concurrency_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "books_variants" DROP CONSTRAINT "books_variants_print_file_id_media_id_fk";
  
  ALTER TABLE "books_variants" DROP CONSTRAINT "books_variants_digital_file_id_media_id_fk";
  
  ALTER TABLE "orders" ADD COLUMN "gelato_submitted_at" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "confirmation_sent_at" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "digital_delivered_at" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "download_counts" jsonb;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "protected_files_id" integer;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "protected_files_updated_at_idx" ON "protected_files" USING btree ("updated_at");
  CREATE INDEX "protected_files_created_at_idx" ON "protected_files" USING btree ("created_at");
  CREATE UNIQUE INDEX "protected_files_filename_idx" ON "protected_files" USING btree ("filename");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_concurrency_key_idx" ON "payload_jobs" USING btree ("concurrency_key");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  ALTER TABLE "books_variants" ADD CONSTRAINT "books_variants_print_file_id_protected_files_id_fk" FOREIGN KEY ("print_file_id") REFERENCES "public"."protected_files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "books_variants" ADD CONSTRAINT "books_variants_digital_file_id_protected_files_id_fk" FOREIGN KEY ("digital_file_id") REFERENCES "public"."protected_files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_protected_files_fk" FOREIGN KEY ("protected_files_id") REFERENCES "public"."protected_files"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_protected_files_id_idx" ON "payload_locked_documents_rels" USING btree ("protected_files_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "protected_files" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "protected_files" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  ALTER TABLE "books_variants" DROP CONSTRAINT "books_variants_print_file_id_protected_files_id_fk";
  
  ALTER TABLE "books_variants" DROP CONSTRAINT "books_variants_digital_file_id_protected_files_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_protected_files_fk";
  
  DROP INDEX "payload_locked_documents_rels_protected_files_id_idx";
  ALTER TABLE "books_variants" ADD CONSTRAINT "books_variants_print_file_id_media_id_fk" FOREIGN KEY ("print_file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "books_variants" ADD CONSTRAINT "books_variants_digital_file_id_media_id_fk" FOREIGN KEY ("digital_file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" DROP COLUMN "gelato_submitted_at";
  ALTER TABLE "orders" DROP COLUMN "confirmation_sent_at";
  ALTER TABLE "orders" DROP COLUMN "digital_delivered_at";
  ALTER TABLE "orders" DROP COLUMN "download_counts";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "protected_files_id";
  DROP TYPE "public"."enum_protected_files_kind";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_task_slug";`)
}
