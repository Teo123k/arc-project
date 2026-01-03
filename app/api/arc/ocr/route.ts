import { NextResponse } from "next/server";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { cleanupExtractedText } from "@/app/lib/core/shared/textCleanup";

function getVisionClient() {
  const raw = process.env.GOOGLE_VISION_CREDENTIALS_JSON;
  if (!raw) {
    throw new Error("Missing GOOGLE_VISION_CREDENTIALS_JSON");
  }

  const credentials = JSON.parse(raw);
  return new ImageAnnotatorClient({ credentials });
}

export async function POST(req: Request) {
  try {
    console.log("[OCR:image] route hit");

    const formData = await req.formData();
    const role = String(formData.get("role") || "note");
    const files = formData.getAll("files") as File[];

    console.log("[OCR:image] files.length =", files.length);
    console.log(
      "[OCR:image] file meta =",
      (files ?? []).map((f: any) => ({
        name: f?.name,
        type: f?.type,
        size: f?.size,
      }))
    );

    if (!files || files.length === 0) {
      return NextResponse.json({ files: [] });
    }

    const client = getVisionClient();
    const results: Array<{
      name: string;
      role: string;
      extractedText: string | null;
      error?: string | null;
    }> = [];

    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());

        // For invoices (especially screenshots), Vision can sometimes produce a weak/empty
        // fullTextAnnotation. We use textDetection as a fallback and choose the richer output.
        const [docResult] = await client.documentTextDetection({
          image: { content: buffer },
          imageContext: role === "invoice" ? undefined : { languageHints: ["en"] },
        });

        const docText = cleanupExtractedText(docResult.fullTextAnnotation?.text ?? null);
        console.log(`[ocr] file: ${file.name}, role: ${role}, docText length: ${docText?.length ?? 0}`);

        let simpleText: string | null = null;
        if (role === "invoice" && (!docText || docText.length < 50)) {
          const [txtResult] = await client.textDetection({
            image: { content: buffer },
            imageContext: undefined,
          });

          const firstAnnotation =
            (txtResult.textAnnotations?.[0]?.description as string | undefined) ?? null;
          simpleText = cleanupExtractedText(firstAnnotation ?? txtResult.fullTextAnnotation?.text ?? null);
          console.log(`[ocr] file: ${file.name}, simpleText fallback length: ${simpleText?.length ?? 0}`);
        }

        const extractedText =
          (simpleText?.length ?? 0) > (docText?.length ?? 0) ? simpleText : docText;
        
        console.log(
          "[OCR:image] extractedText length =",
          extractedText?.length ?? 0
        );

        console.log(`[ocr] file: ${file.name}, final extractedText length: ${extractedText?.length ?? 0}`);
        if (role === "invoice") {
          console.log(`[ocr] file: ${file.name}, extractedText preview:\n${extractedText?.slice(0, 800) ?? "(empty)"}`);
        }

        results.push({
          name: file.name,
          role,
          extractedText,
        });
      } catch (err: any) {
        results.push({
          name: file.name,
          role,
          extractedText: null,
          error: err?.message || "OCR failed",
        });
      }
    }

    return NextResponse.json({ files: results });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "OCR endpoint error" },
      { status: 500 }
    );
  }
}


