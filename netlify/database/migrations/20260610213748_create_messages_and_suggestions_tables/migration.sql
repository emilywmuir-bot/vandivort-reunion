CREATE TABLE "messages" (
	"id" serial PRIMARY KEY,
	"name" text DEFAULT 'Anonymous' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suggestions" (
	"id" serial PRIMARY KEY,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
