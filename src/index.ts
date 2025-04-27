// src/index.ts

import { Elysia, t } from "elysia";
import cors from "@elysiajs/cors";
import { v4 as uuid } from "uuid";
import { extractTextFromPdf } from "./utils/pdf";
import { splitIntoChunks } from "./utils/chunk";
import { getEmbeddings } from "./utils/openai";

// ta connexion Neon via Drizzle/HTTP
import { db } from "./db";
import { documentEmbeddings } from "./db/schema";
import { sql } from "drizzle-orm";
import swagger from "@elysiajs/swagger";

const app = new Elysia().use(swagger()).use(cors());

// ── 1) Upload & stockage comme avant ─────────────────────────────────────────
app.post(
  "/upload",
  async ({ body }) => {
    const file = body.file;
    const fileId = uuid();
    const uploadedAt = new Date();

    const pages = await extractTextFromPdf(file);

    for (let i = 0; i < pages.length; i++) {
      const chunks = splitIntoChunks(pages[i]);
      const embedded = await getEmbeddings(chunks);

      for (const { text, embedding } of embedded) {
        await db.insert(documentEmbeddings).values({
          fileId,
          filename: file.name,
          page: i + 1,
          uploadedAt,
          chunk: text,
          embedding,
        });
      }
    }

    return { fileId, status: "saved to Neon" };
  },
  {
    body: t.Object({
      file: t.File({ format: "application/pdf" }),
    }),
  }
);

// ── 2) Endpoint de recherche vectorielle ────────────────────────────────────────
app.post(
  "/search",
  async ({ body }) => {
    const { query } = body;
    if (!query) return { error: 'Champ "query" requis' };

    // 1) vectoriser la question
    const [{ embedding: qEmbedding }] = await getEmbeddings([query]);

    // 2) préparer la chaîne vectorielle et le ORDER BY en raw
    const vecTxt = `[${qEmbedding.join(",")}]`;
    const orderClause = sql.raw(`embedding <=> '${vecTxt}'::vector(1536)`);

    // 3) exécuter la recherche
    const results = await db
      .select({
        chunk: documentEmbeddings.chunk,
        filename: documentEmbeddings.filename,
        page: documentEmbeddings.page,
        uploadedAt: documentEmbeddings.uploadedAt,
      })
      .from(documentEmbeddings)
      .orderBy(orderClause)
      .limit(5);

    return { query, results };
  },
  {
    body: t.Object({
      query: t.String(),
    }),
  }
);

// Healthcheck
app.get("/", () => ({ status: "ok" }));

app.listen(3000);
console.log("🚀 Elysia listening on http://localhost:3000");
