CREATE TABLE "board_idempotency" (
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
	CONSTRAINT "board_idempotency_scope_key_pk" PRIMARY KEY("scope","key"),
	CONSTRAINT "board_idempotency_state" CHECK ("board_idempotency"."state" = 'completed')
);
--> statement-breakpoint
CREATE TABLE "boards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "boards_version_positive" CHECK ("boards"."version" > 0),
	CONSTRAINT "boards_name_nonblank" CHECK (length(trim("boards"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_idempotency_expires_at_idx" ON "board_idempotency" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "boards_slug_unique" ON "boards" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "boards_owner_active_created_idx" ON "boards" USING btree ("owner_id","deleted_at","created_at","id");