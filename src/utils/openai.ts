import { OpenAI } from "openai";
import dotenv from "dotenv";
dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  throw new Error("⚠️ MISSING OPENAI_API_KEY in .env");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Appelle l’API OpenAI pour générer des embeddings
 */
export async function getEmbeddings(
  chunks: string[]
): Promise<Array<{ text: string; embedding: number[] }>> {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: chunks,
  });

  return res.data.map((d, i) => ({
    text: chunks[i],
    embedding: d.embedding,
  }));
}
