// src/db/index.ts

import { drizzle } from "drizzle-orm/neon-http";
import dotenv from "dotenv";
import * as schema from "./schema";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("⚠️ DATABASE_URL manquant dans .env");
}

// On passe simplement la connection string
export const db = drizzle(process.env.DATABASE_URL, {
  schema,
});
