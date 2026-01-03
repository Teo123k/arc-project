import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Suggest locally available, seasonal ingredients based on location and date.
 * Used for ingredient-first menu planning.
 */
export async function POST(req: NextRequest) {
  try {
    const { location, date, occasion, guestCount } = await req.json();

    if (!location) {
      return NextResponse.json(
        { error: "Location is required" },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a culinary expert helping a professional chef discover locally available, seasonal ingredients.

Given a location and date, suggest ingredients that would be:
1. Locally available and in season
2. Fresh and at peak quality
3. Good value (abundant = affordable)
4. Suitable for professional catering

Organize ingredients by category:
- Proteins (seafood, meat, poultry)
- Vegetables
- Fruits
- Herbs & Aromatics
- Dairy & Eggs
- Pantry Staples

For each ingredient, include:
- name: Common name
- category: One of the categories above
- seasonality: "peak" | "available" | "limited"
- notes: Brief note about quality, sourcing, or usage (optional)

Respond with ONLY valid JSON, no markdown. Format:
{
  "location": "string",
  "season": "string (e.g., 'Late December - Summer')",
  "ingredients": [
    { "name": "...", "category": "...", "seasonality": "...", "notes": "..." }
  ],
  "marketTip": "Optional tip about local markets or sourcing"
}`;

    const userPrompt = `Location: ${location}
Date: ${date || "Current season"}
Occasion: ${occasion || "Catering event"}
Guest count: ${guestCount || "Unknown"}

Suggest 20-30 locally available, seasonal ingredients for this chef to consider.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content?.trim() || "{}";

    let result: Record<string, unknown> = {};
    try {
      const cleaned = content.replace(/^```json?\n?|\n?```$/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error("[suggest-local-ingredients] Failed to parse AI response:", content);
      return NextResponse.json({ 
        ingredients: [],
        error: "Failed to parse ingredient suggestions" 
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[suggest-local-ingredients] Error:", error);
    return NextResponse.json(
      { error: "Failed to suggest ingredients" },
      { status: 500 }
    );
  }
}

