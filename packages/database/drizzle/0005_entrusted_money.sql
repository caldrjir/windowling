ALTER TABLE "character" ADD COLUMN "entrusted_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "money_ask_kind" text;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "money_ask_cents" integer;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "money_ask_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "money_asked_at" timestamp with time zone;