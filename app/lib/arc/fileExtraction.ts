export type ExtractedFileContent = {
  fileName: string;
  fileType: string;
  extractedText: string | null;
  extractionMethod: "text" | "unsupported";
  error: string | null;
};

/**
 * Extract text content from a single file
 * Currently supports: .txt, .md, and text/* MIME types
 */
export async function extractFileContent(file: File): Promise<ExtractedFileContent> {
  const result: ExtractedFileContent = {
    fileName: file.name,
    fileType: file.type || "unknown",
    extractedText: null,
    extractionMethod: "unsupported",
    error: null,
  };

  try {
    // Check if file is text-based
    const isTextFile =
      file.type.startsWith("text/") ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".md");

    if (isTextFile) {
      try {
        const text = await file.text();
        // Limit to 30,000 chars to avoid huge prompts
        result.extractedText = text.slice(0, 30000);
        result.extractionMethod = "text";
      } catch (err) {
        result.error = err instanceof Error ? err.message : "Failed to read file";
      }
    } else {
      result.error = "Unsupported file type (only .txt and .md supported currently)";
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : "Extraction failed";
  }

  return result;
}

/**
 * Extract content from multiple files and combine into a single reference text block
 */
export async function extractFilesContent(
  files: File[]
): Promise<{
  files: ExtractedFileContent[];
  combinedText: string;
}> {
  const extractedFiles = await Promise.all(
    files.map((file) => extractFileContent(file))
  );

  const parts: string[] = [];

  for (const extracted of extractedFiles) {
    parts.push(`--- FILE: ${extracted.fileName} (${extracted.fileType}) ---`);
    if (extracted.extractedText) {
      parts.push(extracted.extractedText);
    } else {
      parts.push("[UNSUPPORTED FILE TYPE: no text extracted]");
    }
    parts.push(""); // Blank line between files
  }

  let combinedText = parts.join("\n");
  // Limit total combined text to 60,000 chars
  if (combinedText.length > 60000) {
    combinedText = combinedText.slice(0, 60000) + "\n[... content truncated ...]";
  }

  return {
    files: extractedFiles,
    combinedText,
  };
}










