// src/index.ts
import { Elysia, t } from "elysia";
import cors from "@elysiajs/cors";
import swagger from "@elysiajs/swagger";
import dotenv from "dotenv";
import { v4 as uuid } from "uuid";
import OpenAI from "openai";
import { extractTextFromPdf } from "./utils/pdf";
import { splitIntoSemanticallyChunks } from "./utils/chunk";
import { getEmbeddings } from "./utils/openai";
import { db } from "./db";
import { documentEmbeddings } from "./db/schema";
import { sql } from "drizzle-orm";

dotenv.config();
if (!process.env.OPENAI_API_KEY)
  throw new Error("Missing OPENAI_API_KEY in .env");

const chatClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Types
interface Hit {
  chunk: string;
  filename: string;
  page: number;
  uploadedAt: Date;
  score: number;
}

type UploadResponse = { fileId: string; status: string };
type SearchBody = { query: string; fileId?: string };
type AnswerBody = { query: string; fileId: string };

const app = new Elysia().use(swagger()).use(cors());

// Healthcheck
app.get("/", () => ({ status: "ok" }));

// 1) Upload: PDF → extraction, découpe, embeddings, stockage Neon
app.post(
  "/upload",
  async ({ body }) => {
    const file = body.file;
    if (!file) {
      return new Response(JSON.stringify({ error: "Aucun PDF reçu" }), {
        status: 400,
      });
    }
    const fileId = uuid();
    // Use a Date object, not a string, so Drizzle can call toISOString() itself
    const uploadedAt = new Date();

    const pages = await extractTextFromPdf(file);
    for (let i = 0; i < pages.length; i++) {
      const chunks = splitIntoSemanticallyChunks(pages[i], 150, 50);
      const embedded = await getEmbeddings(chunks);
      for (const { text, embedding } of embedded) {
        // Clean null bytes
        const clean = text.replace(/\u0000/g, "");
        await db.insert(documentEmbeddings).values({
          fileId,
          filename: file.name,
          page: i + 1,
          uploadedAt,
          chunk: clean,
          embedding,
        });
      }
    }
    return { fileId, status: "saved" } as UploadResponse;
  },
  { body: t.Object({ file: t.File({ format: "application/pdf" }) }) }
);

// 2) Search: renvoie les meilleurs chunks (scores) pour une requête et un fileId
app.post(
  "/search",
  async ({ body }) => {
    const { query, fileId } = body as SearchBody;
    if (!query) return { error: "'query' requis" };

    const [{ embedding: qEmb }] = await getEmbeddings([query]);
    const vec = `[${qEmb.join(",")}]`;
    const orderClause = sql.raw(`embedding <=> '${vec}'::vector(1536)`);

    let builder = db
      .select({
        chunk: documentEmbeddings.chunk,
        page: documentEmbeddings.page,
        score: orderClause,
      })
      .from(documentEmbeddings)
      .orderBy(orderClause)
      .limit(10);
    if (fileId)
      builder = builder.where(sql`${documentEmbeddings.fileId} = ${fileId}`);

    const hits = await builder;
    return { query, fileId, hits };
  },
  { body: t.Object({ query: t.String(), fileId: t.Optional(t.String()) }) }
);

// 3) Answer: RAG + génération finale en français, se base strictement sur le contexte
app.post(
  "/answer",
  async ({ body }) => {
    const { query, fileId } = body as AnswerBody;
    if (!query || !fileId) return { error: "'query' et 'fileId' requis" };

    // Embedding de la question
    const [{ embedding: qEmb }] = await getEmbeddings([query]);
    const vec = `[${qEmb.join(",")}]`;
    const orderClause = sql.raw(`embedding <=> '${vec}'::vector(1536)`);

    // Récupère top 5
    const top5 = await db
      .select({
        chunk: documentEmbeddings.chunk,
        page: documentEmbeddings.page,
      })
      .from(documentEmbeddings)
      .where(sql`${documentEmbeddings.fileId} = ${fileId}`)
      .orderBy(orderClause)
      .limit(5);

    // Construit le prompt
    const context = top5
      .map((h, i) => `(page ${h.page}) : ${h.chunk}`)
      .join("\n\n");

    const messages = [
      {
        role: "system",
        content:
          "Réponds uniquement en français. " +
          "Utilise uniquement les informations fournies, sans rien inventer.",
      },
      {
        role: "user",
        content:
          `Question : ${query}\n\n${context}\n\n` +
          "Réponds de façon claire et structurée, étape par étape, avec des exemples si pertinent.",
      },
    ];

    const res = await chatClient.chat.completions.create({
      model: "gpt-4.1-mini",
      messages,
      temperature: 0,
      max_tokens: 800,
    });

    const answer = res.choices[0].message?.content.trim() || "";
    return {
      answer,
      sources: top5.map((h) => ({ filename: h.filename, page: h.page })),
    };
  },
  { body: t.Object({ query: t.String(), fileId: t.String() }) }
);

app.listen(3000);
console.log("🚀 Server listening on http://localhost:3000");
