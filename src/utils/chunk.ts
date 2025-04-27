/**
 * Découpe un texte en chunks d'environ `maxTokens` tokens.
 * On approxime 1 token ≃ 4 caractères.
 */
export function splitIntoChunks(text: string, maxTokens = 200): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let current: string[] = [];

  for (const w of words) {
    const joined = current.concat(w).join(" ");
    if (joined.length <= maxTokens * 4) {
      current.push(w);
    } else {
      chunks.push(current.join(" "));
      current = [w];
    }
  }
  if (current.length) chunks.push(current.join(" "));
  return chunks;
}
