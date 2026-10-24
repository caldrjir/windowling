CREATE TABLE "visitor" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "presence" ADD COLUMN "visitor_id" text;--> statement-breakpoint
ALTER TABLE "visitor" ADD CONSTRAINT "visitor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visitor_last_seen_idx" ON "visitor" USING btree ("last_seen");