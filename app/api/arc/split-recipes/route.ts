export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";

/**
 * POST /api/arc/split-recipes
 * 
 * Takes OCR-extracted text from a multi-recipe PDF and splits it into
 * individual recipe text blocks.
 * 
 * Request body: { extractedText: string }
 * Response: { recipes: Array<{ name: string, text: string }> }
 */
export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const extractedText = body?.extractedText ?? "";

    if (!extractedText || extractedText.trim().length < 50) {
      // Text too short, treat as single recipe
      return NextResponse.json({
        recipes: [{ name: "Recipe", text: extractedText.trim() }],
        count: 1,
      });
    }

    const client = new OpenAI({ apiKey });

    const headTailText = (raw: string, maxChars: number) => {
      const text = String(raw || "");
      if (text.length <= maxChars) return text;
      const headChars = Math.floor(maxChars * 0.6);
      const tailChars = Math.max(0, maxChars - headChars);
      const head = text.slice(0, headChars);
      const tail = tailChars > 0 ? text.slice(-tailChars) : "";
      return `${head}\n\n…\n\n${tail}`;
    };

    const prompt = `You are analyzing OCR text that may contain MULTIPLE recipes.

Your task is to:
1. Determine how many distinct recipes are in this text
2. Extract each recipe as a separate text block
3. Identify the name of each recipe

Return STRICT JSON only (no markdown, no explanation):
{
  "recipeCount": number,
  "recipes": [
    {
      "name": string,
      "text": string
    }
  ]
}

Rules:
- If there is only 1 recipe, return recipeCount: 1 with that single recipe
- Look for clear recipe separators like: recipe titles/headers, page breaks, "Recipe 1", numbered recipes, etc.
- Each recipe's "text" should include its full content: name, ingredients, and instructions
- Preserve the original text as much as possible, just split it correctly
- If you cannot determine boundaries, return the entire text as a single recipe
- Recipe names should be the actual dish name if identifiable, not generic labels

Text to analyze:
${headTailText(extractedText, 24_000)}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";

    let parsed: { recipeCount: number; recipes: Array<{ name: string; text: string }> } | null = null;

    try {
      // Try to parse JSON, handle markdown code blocks
      let jsonStr = raw;
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      parsed = JSON.parse(jsonStr);
    } catch {
      // If parsing fails, return original text as single recipe
      return NextResponse.json({
        recipes: [{ name: "Recipe", text: extractedText.trim() }],
        count: 1,
        parseError: true,
      });
    }

    if (!parsed || !Array.isArray(parsed.recipes) || parsed.recipes.length === 0) {
      return NextResponse.json({
        recipes: [{ name: "Recipe", text: extractedText.trim() }],
        count: 1,
      });
    }

    // Validate and clean up recipes
    const validRecipes = parsed.recipes
      .filter((r) => r && typeof r.text === "string" && r.text.trim().length > 20)
      .map((r, i) => ({
        name: typeof r.name === "string" && r.name.trim() ? r.name.trim() : `Recipe ${i + 1}`,
        text: r.text.trim(),
      }));

    if (validRecipes.length === 0) {
      return NextResponse.json({
        recipes: [{ name: "Recipe", text: extractedText.trim() }],
        count: 1,
      });
    }

    return NextResponse.json({
      recipes: validRecipes,
      count: validRecipes.length,
    });
  } catch (err: any) {
    console.error("Split recipes API error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to split recipes" },
      { status: 500 }
    );
  }
}

