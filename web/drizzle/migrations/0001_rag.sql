CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "doc_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"section" text NOT NULL,
	"url" text NOT NULL,
	"text" text NOT NULL,
	"embedding" vector(768) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "doc_chunks_embedding_idx" ON "doc_chunks" USING hnsw ("embedding" vector_cosine_ops);
