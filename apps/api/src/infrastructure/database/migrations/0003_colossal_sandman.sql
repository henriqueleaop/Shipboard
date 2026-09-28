CREATE TABLE "suggestion_idempotency" (
	"scope" text NOT NULL,
	"key" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"state" text NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb NOT NULL,
	"response_location" text NOT NULL,
	"response_etag" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "suggestion_idempotency_scope_key_pk" PRIMARY KEY("scope","key"),
	CONSTRAINT "suggestion_idempotency_state_completed" CHECK ("suggestion_idempotency"."state" = 'completed')
);
--> statement-breakpoint
CREATE TABLE "suggestions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"board_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'UNDER_REVIEW' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "suggestions_title_nonblank" CHECK (length(trim("suggestions"."title")) >= 3),
	CONSTRAINT "suggestions_description_nonblank" CHECK (length(trim("suggestions"."description")) > 0),
	CONSTRAINT "suggestions_version_positive" CHECK ("suggestions"."version" > 0),
	CONSTRAINT "suggestions_status_allowed" CHECK ("suggestions"."status" IN ('UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'SHIPPED', 'REJECTED'))
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"suggestion_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_suggestion_id_suggestions_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."suggestions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "suggestion_idempotency_expires_at_idx" ON "suggestion_idempotency" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "suggestions_board_active_created_idx" ON "suggestions" USING btree ("board_id","created_at","id") WHERE "suggestions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "suggestions_board_active_status_idx" ON "suggestions" USING btree ("board_id","status") WHERE "suggestions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "votes_one_active_user_suggestion_idx" ON "votes" USING btree ("suggestion_id","user_id") WHERE "votes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "votes_suggestion_active_idx" ON "votes" USING btree ("suggestion_id") WHERE "votes"."deleted_at" IS NULL;