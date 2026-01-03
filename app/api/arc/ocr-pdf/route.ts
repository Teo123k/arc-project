export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { Storage } from "@google-cloud/storage";
import { cleanupExtractedText } from "@/app/lib/core/shared/textCleanup";

function getGoogleCredentials() {
  const raw = process.env.GOOGLE_VISION_CREDENTIALS_JSON;
  if (!raw) {
    throw new Error("Missing GOOGLE_VISION_CREDENTIALS_JSON");
  }
  return JSON.parse(raw);
}

function getVisionClient() {
  const credentials = getGoogleCredentials();
  return new ImageAnnotatorClient({ credentials });
}

function getStorageClient() {
  const credentials = getGoogleCredentials();
  return new Storage({ credentials });
}

function sanitizeObjectName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

async function extractPdfTextViaVision({
  bucket,
  file,
  role,
}: {
  bucket: string;
  file: File;
  role: string;
}): Promise<{ name: string; role: string; extractedText: string | null; error?: string | null }> {
  let storage: ReturnType<typeof getStorageClient>;
  let vision: ReturnType<typeof getVisionClient>;
  let inputFile: any = null;
  let outputFiles: any[] = [];

  try {
    storage = getStorageClient();
    vision = getVisionClient();
  } catch (err: any) {
    console.error("[ocr-pdf] Failed to initialize GCS/Vision clients:", err?.message);
    throw new Error(`Failed to initialize GCS clients: ${err?.message}`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const uid = crypto.randomUUID();

  const inputObjectPath = `arc-ocr-input/${Date.now()}-${uid}-${sanitizeObjectName(
    file.name || "document.pdf"
  )}`;
  const outputPrefixPath = `arc-ocr-output/${Date.now()}-${uid}/`;

  try {
    console.log(`[ocr-pdf] Uploading to GCS: gs://${bucket}/${inputObjectPath}`);
    inputFile = storage.bucket(bucket).file(inputObjectPath);
    await inputFile.save(buffer, {
      resumable: false,
      contentType: file.type || "application/pdf",
    });
    console.log(`[ocr-pdf] Upload complete`);
  } catch (err: any) {
    console.error("[ocr-pdf] Failed to upload to GCS:", err?.message);
    throw new Error(`GCS upload failed: ${err?.message}`);
  }

  const gcsInputUri = `gs://${bucket}/${inputObjectPath}`;
  const gcsOutputUri = `gs://${bucket}/${outputPrefixPath}`;

  try {
    console.log(`[ocr-pdf] Starting Vision API batch annotation...`);
    const [operation] = await vision.asyncBatchAnnotateFiles({
      requests: [
        {
          inputConfig: {
            gcsSource: { uri: gcsInputUri },
            mimeType: "application/pdf",
          },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          outputConfig: {
            gcsDestination: { uri: gcsOutputUri },
            batchSize: 20,
          },
        },
      ],
    });

    console.log(`[ocr-pdf] Waiting for Vision API operation to complete...`);
    await operation.promise();
    console.log(`[ocr-pdf] Vision API operation complete`);
  } catch (err: any) {
    console.error("[ocr-pdf] Vision API failed:", err?.message);
    // Cleanup input file
    try {
      if (inputFile) await inputFile.delete();
    } catch {}
    throw new Error(`Vision API failed: ${err?.message}`);
  }

  let combined = "";

  try {
    const [files] = await storage.bucket(bucket).getFiles({
      prefix: outputPrefixPath,
    });
    outputFiles = files;

    const jsonFiles = outputFiles
      .map((f: any) => f.name)
      .filter((name: string) => name.toLowerCase().endsWith(".json"))
      .sort();

    console.log(`[ocr-pdf] Found ${jsonFiles.length} output JSON files`);

    for (const name of jsonFiles) {
      const [content] = await storage.bucket(bucket).file(name).download();
      const parsed = JSON.parse(content.toString("utf-8"));
      const responses: any[] = Array.isArray(parsed?.responses) ? parsed.responses : [];
      for (const r of responses) {
        const pageText = r?.fullTextAnnotation?.text;
        if (typeof pageText === "string" && pageText.trim()) {
          combined += (combined ? "\n\n" : "") + pageText.trim();
        }
      }
    }
  } catch (err: any) {
    console.error("[ocr-pdf] Failed to read Vision output:", err?.message);
    throw new Error(`Failed to read Vision output: ${err?.message}`);
  } finally {
    // Cleanup GCS files
    try {
      if (inputFile) await inputFile.delete();
      for (const f of outputFiles) {
        await f.delete();
      }
    } catch (cleanupErr: any) {
      console.warn("[ocr-pdf] Cleanup warning:", cleanupErr?.message);
    }
  }

  console.log(`[ocr-pdf] Extracted ${combined.length} chars from ${file.name}`);

  return {
    name: file.name,
    role,
    extractedText: cleanupExtractedText(combined || null),
  };
}

export async function POST(req: Request) {
  try {
    console.log("[OCR:pdf] route hit");

    const bucket = process.env.GCS_OCR_BUCKET;
    if (!bucket) {
      console.error("[ocr-pdf] Missing GCS_OCR_BUCKET environment variable");
      return NextResponse.json(
        { files: [], error: "Missing GCS_OCR_BUCKET" },
        { status: 500 }
      );
    }

    // Check credentials exist
    const credsRaw = process.env.GOOGLE_VISION_CREDENTIALS_JSON;
    if (!credsRaw) {
      console.error("[ocr-pdf] Missing GOOGLE_VISION_CREDENTIALS_JSON environment variable");
      return NextResponse.json(
        { files: [], error: "Missing GOOGLE_VISION_CREDENTIALS_JSON" },
        { status: 500 }
      );
    }

    // Validate credentials are valid JSON
    try {
      JSON.parse(credsRaw);
    } catch (parseErr) {
      console.error("[ocr-pdf] Invalid GOOGLE_VISION_CREDENTIALS_JSON - not valid JSON");
      return NextResponse.json(
        { files: [], error: "Invalid GOOGLE_VISION_CREDENTIALS_JSON format" },
        { status: 500 }
      );
    }

    console.log(`[ocr-pdf] Processing request, bucket: ${bucket}`);

    const formData = await req.formData();
    const role = String(formData.get("role") || "note");
    const files = formData.getAll("files") as File[];

    console.log("[OCR:pdf] files.length =", files.length);
    console.log(
      "[OCR:pdf] file meta =",
      (files ?? []).map((f: any) => ({
        name: f?.name,
        type: f?.type,
        size: f?.size,
      }))
    );

    console.log(`[ocr-pdf] Files to process: ${files.length}, role: ${role}`);

    if (!files || files.length === 0) {
      return NextResponse.json({ files: [] });
    }

    const results: Array<{
      name: string;
      role: string;
      extractedText: string | null;
      error?: string | null;
    }> = [];

    for (const file of files) {
      console.log(`[ocr-pdf] Processing file: ${file.name}, size: ${file.size}, type: ${file.type}`);
      try {
        const result = await extractPdfTextViaVision({ bucket, file, role });
        console.log(`[ocr-pdf] Success for ${file.name}, extracted ${result.extractedText?.length ?? 0} chars`);
        console.log(
          "[OCR:pdf] extractedText length =",
          result.extractedText?.length ?? 0
        );
        results.push(result);
      } catch (err: any) {
        console.error(`[ocr-pdf] Error processing ${file.name}:`, err?.message || err);
        results.push({
          name: file.name,
          role,
          extractedText: null,
          error: err?.message || "PDF OCR failed",
        });
      }
    }

    return NextResponse.json({ files: results });
  } catch (err: any) {
    console.error("[ocr-pdf] Top-level error:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "PDF OCR endpoint error" },
      { status: 500 }
    );
  }
}


