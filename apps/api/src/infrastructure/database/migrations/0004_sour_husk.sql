DROP INDEX "boards_slug_unique";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "github_username" text;--> statement-breakpoint
UPDATE "user"
SET "username" = 'member-' || substring(replace("id"::text, '-', '') FROM 1 FOR 12)
WHERE "username" IS NULL;--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "visibility" text DEFAULT 'PUBLIC' NOT NULL;--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "github_repository_url" text;--> statement-breakpoint
CREATE UNIQUE INDEX "user_username_unique" ON "user" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "boards_owner_slug_unique" ON "boards" USING btree ("owner_id","slug");
