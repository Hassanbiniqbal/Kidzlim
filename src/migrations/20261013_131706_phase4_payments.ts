import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_webhook_events_provider" AS ENUM('stripe', 'gelato');
  CREATE TABLE "webhook_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"provider" "enum_webhook_events_provider" NOT NULL,
  	"event_id" varchar,
  	"type" varchar,
  	"order_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "orders" ADD COLUMN "subtotal_a_e_d" numeric;
  ALTER TABLE "orders" ADD COLUMN "shipping_method_name" varchar;
  ALTER TABLE "orders" ADD COLUMN "shipping_method_gelato_method_uids" jsonb;
  ALTER TABLE "orders" ADD COLUMN "stripe_customer_id" varchar;
  ALTER TABLE "orders" ADD COLUMN "paid_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "webhook_events_id" integer;
  ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "webhook_events_key_idx" ON "webhook_events" USING btree ("key");
  CREATE INDEX "webhook_events_event_id_idx" ON "webhook_events" USING btree ("event_id");
  CREATE INDEX "webhook_events_order_idx" ON "webhook_events" USING btree ("order_id");
  CREATE INDEX "webhook_events_updated_at_idx" ON "webhook_events" USING btree ("updated_at");
  CREATE INDEX "webhook_events_created_at_idx" ON "webhook_events" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_webhook_events_fk" FOREIGN KEY ("webhook_events_id") REFERENCES "public"."webhook_events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_webhook_events_id_idx" ON "payload_locked_documents_rels" USING btree ("webhook_events_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "webhook_events" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "webhook_events" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_webhook_events_fk";
  
  DROP INDEX "payload_locked_documents_rels_webhook_events_id_idx";
  ALTER TABLE "orders" DROP COLUMN "subtotal_a_e_d";
  ALTER TABLE "orders" DROP COLUMN "shipping_method_name";
  ALTER TABLE "orders" DROP COLUMN "shipping_method_gelato_method_uids";
  ALTER TABLE "orders" DROP COLUMN "stripe_customer_id";
  ALTER TABLE "orders" DROP COLUMN "paid_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "webhook_events_id";
  DROP TYPE "public"."enum_webhook_events_provider";`)
}
