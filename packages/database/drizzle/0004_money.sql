ALTER TABLE "character" ADD COLUMN "balance_cents" integer DEFAULT 90000 NOT NULL;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "unpaid_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "paid_at" timestamp with time zone;