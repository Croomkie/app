import pdfParse from "pdf-parse/lib/pdf-parse.js";

export async function extractTextFromPdf(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const data = await pdfParse(buffer);

  const pages = data.text
    .split("\f")
    .map((p) => p.trim())
    .filter(Boolean);

  return pages;
}
