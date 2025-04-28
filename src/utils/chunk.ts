// src/utils/chunk.ts

/**
 * Sépare un texte en segments sémantiques fins :
 * 1) Paragraphes via double saut de ligne.
 * 2) Sliding window avec overlap pour les longs paragraphes.
 * 3) Filtrage : longueur min, suppression des doublons.
 */

function approxTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

function slidingWindowChunks(
    text: string,
    maxTokens = 150,
    overlap = 50
): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    let count = 0;
    let end = start;
    while (end < words.length && count < maxTokens) {
      count++;
      end++;
    }
    chunks.push(words.slice(start, end).join(' '));
    if (end >= words.length) break;
    start = Math.max(0, end - overlap);
  }

  return chunks;
}

/**
 * Découpe un texte en chunks sémantiques, filtre les trop petits
 * et enlève les doublons.
 */
export function splitIntoSemanticallyChunks(
    text: string,
    maxTokens = 150,
    overlap = 50,
    minWords = 5
): string[] {
  // 1) Paragraphes
  const paras = text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

  // 2) Découpe + collecte
  const all: string[] = [];
  for (const p of paras) {
    const tokenCount = approxTokenCount(p);
    if (tokenCount <= maxTokens) {
      all.push(p);
    } else {
      all.push(...slidingWindowChunks(p, maxTokens, overlap));
    }
  }

  // 3) Filtrage longueur + doublons
  const seen = new Set<string>();
  return all
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.split(/\s+/).length >= minWords)
      .filter((chunk) => {
        if (seen.has(chunk)) return false;
        seen.add(chunk);
        return true;
      });
}
