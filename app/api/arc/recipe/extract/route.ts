import { NextResponse } from "next/server";

import {
  extractStructuredRecipeFields,
  buildStructuredRecipeExtractionPrompt,
} from "@/app/lib/core/ai/enrichmentPipeline";
import { runARC } from "@/app/lib/arc/arcAgent";
import type { RecipeIntelligenceLike } from "@/app/lib/core/shared/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      text,
      titleHint,
      source,
    }: {
      text: string;
      titleHint?: string;
      source?: string;
    } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid text" },
        { status: 400 }
      );
    }

    const prompt = buildStructuredRecipeExtractionPrompt({
      text,
      titleHint,
      source,
    });

    const raw = await runARC({
      systemPrompt,
      messages: [
        {
          role: "user",
          content: extractedText,
        },
      ],
    });
    const parsed = JSON.parse(raw);

    const recipeIntelligence: RecipeIntelligenceLike =
      extractStructuredRecipeFields(parsed);

    return NextResponse.json({
      recipeIntelligence,
      debug: {
        source,
        textLength: text.length,
      },
    });
  } catch (error) {
    console.error("[recipe/extract] failed", error);
    return NextResponse.json(
      { error: "Recipe extraction failed" },
      { status: 500 }
    );
  }
}
