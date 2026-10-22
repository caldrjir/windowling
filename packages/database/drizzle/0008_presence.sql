CREATE TABLE "presence" (
	"client_id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"user_id" text,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "presence" ADD CONSTRAINT "presence_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "presence_last_seen_idx" ON "presence" USING btree ("last_seen");