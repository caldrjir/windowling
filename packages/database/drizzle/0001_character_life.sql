ALTER TABLE "character" ADD COLUMN "hunger" double precision DEFAULT 0.3 NOT NULL;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "energy" double precision DEFAULT 0.8 NOT NULL;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "mood" double precision DEFAULT 0.7 NOT NULL;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "activity" text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "activity_started_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "activity_ends_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "world" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;