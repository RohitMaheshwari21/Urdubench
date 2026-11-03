CREATE TABLE "wa_users" (
	"id" text PRIMARY KEY NOT NULL,
	"language" text DEFAULT 'roman' NOT NULL,
	"current_item" text,
	"answered" integer DEFAULT 0 NOT NULL,
	"correct" integer DEFAULT 0 NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
