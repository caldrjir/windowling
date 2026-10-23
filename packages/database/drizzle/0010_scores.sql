CREATE TABLE "score" (
	"user_id" text NOT NULL,
	"game" text NOT NULL,
	"board" text NOT NULL,
	"value" bigint NOT NULL,
	"achieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "score_user_id_game_board_pk" PRIMARY KEY("user_id","game","board")
);
--> statement-breakpoint
ALTER TABLE "score" ADD CONSTRAINT "score_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "score_board_idx" ON "score" USING btree ("game","board","value");