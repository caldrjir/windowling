CREATE TABLE "memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"note" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"importance" double precision NOT NULL,
	"emotion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationship" (
	"world_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"affinity" double precision DEFAULT 0 NOT NULL,
	"trust" double precision DEFAULT 0.3 NOT NULL,
	"familiarity" double precision DEFAULT 0 NOT NULL,
	"conversations" integer DEFAULT 0 NOT NULL,
	"wake_ups" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relationship_world_id_subject_pk" PRIMARY KEY("world_id","subject")
);
--> statement-breakpoint
ALTER TABLE "memory" ADD CONSTRAINT "memory_world_id_world_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."world"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship" ADD CONSTRAINT "relationship_world_id_world_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."world"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memory_world_created_idx" ON "memory" USING btree ("world_id","created_at");