// src/db/schema.ts
import {
  pgTable,
  serial,
  uuid,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core";

export const documentEmbeddings = pgTable("document_embeddings", {
  id: serial("id").primaryKey(),
  fileId: uuid("file_id").notNull(),
  filename: text("filename"),
  page: integer("page"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  chunk: text("chunk"),
  embedding: vector("embedding", { dimensions: 1536 }),
});
