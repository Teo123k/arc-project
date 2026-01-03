export function cleanupExtractedText(extractedText: string | null) {
  if (!extractedText) return null;
  return extractedText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();
}



