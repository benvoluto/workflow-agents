CREATE TABLE "attention_items" (
	"id" text PRIMARY KEY NOT NULL,
	"program_id" uuid NOT NULL,
	"record_id" uuid,
	"urgency" text NOT NULL,
	"owner_role" text,
	"rank" integer NOT NULL,
	"sort_key" double precision NOT NULL,
	"item" jsonb NOT NULL,
	"spec_version" integer,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queue_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"program_id" uuid,
	"records_scanned" integer DEFAULT 0 NOT NULL,
	"items_written" integer DEFAULT 0 NOT NULL,
	"items_removed" integer DEFAULT 0 NOT NULL,
	"mismatches" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record_wakeups" (
	"record_id" uuid PRIMARY KEY NOT NULL,
	"program_id" uuid NOT NULL,
	"wake_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attention_items" ADD CONSTRAINT "attention_items_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attention_items" ADD CONSTRAINT "attention_items_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_runs" ADD CONSTRAINT "queue_runs_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_wakeups" ADD CONSTRAINT "record_wakeups_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_wakeups" ADD CONSTRAINT "record_wakeups_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attention_order_idx" ON "attention_items" USING btree ("rank","sort_key");--> statement-breakpoint
CREATE INDEX "attention_program_idx" ON "attention_items" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "attention_record_idx" ON "attention_items" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "attention_owner_idx" ON "attention_items" USING btree ("owner_role");--> statement-breakpoint
CREATE INDEX "queue_run_idx" ON "queue_runs" USING btree ("kind","at");--> statement-breakpoint
CREATE INDEX "wakeup_due_idx" ON "record_wakeups" USING btree ("wake_at");