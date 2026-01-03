import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Suggest drink pairings based on the menu dishes.
 * Returns both alcoholic and non-alcoholic options.
 */
export async function POST(req: NextRequest) {
  try {
    const { dishes, occasion, guestCount, location } = await req.json();

    if (!dishes || !Array.isArray(dishes) || dishes.length === 0) {
      return NextResponse.json(
        { error: "At least one dish is required" },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a sommelier and beverage expert helping a chef plan drink pairings for a catering event.

Given the menu dishes, suggest drink pairings that:
1. Complement the flavors of the food
2. Are appropriate for the occasion
3. Include BOTH alcoholic and non-alcoholic options
4. Consider local/regional beverages when relevant
5. Are practical for catering (not overly complex cocktails)

For each drink suggestion, provide:
- name: Drink name
- type: "wine" | "beer" | "cocktail" | "spirit" | "mocktail" | "soft" | "tea" | "coffee" | "juice"
- isAlcoholic: boolean
- description: Brief description
- pairsWith: Array of dish names it pairs well with
- servingNotes: Optional notes about serving (temperature, glassware, etc.)

Respond with ONLY valid JSON, no markdown. Format:
{
  "alcoholic": [
    { "name": "...", "type": "...", "isAlcoholic": true, "description": "...", "pairsWith": ["..."], "servingNotes": "..." }
  ],
  "nonAlcoholic": [
    { "name": "...", "type": "...", "isAlcoholic": false, "description": "...", "pairsWith": ["..."], "servingNotes": "..." }
  ],
  "signatureSuggestion": {
    "name": "Optional signature drink suggestion",
    "description": "Why this would be special for this event"
  }
}`;

    const userPrompt = `Menu dishes:
${dishes.map((d: string, i: number) => `${i + 1}. ${d}`).join("\n")}

Occasion: ${occasion || "Catering event"}
Guest count: ${guestCount || "Unknown"}
Location: ${location || "Not specified"}

Suggest 4-6 drink pairings (mix of alcoholic and non-alcoholic options).`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content?.trim() || "{}";

    let result: Record<string, unknown> = {};
    try {
      const cleaned = content.replace(/^```json?\n?|\n?```$/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error("[suggest-drink-pairings] Failed to parse AI response:", content);
      return NextResponse.json({ 
        alcoholic: [],
        nonAlcoholic: [],
        error: "Failed to parse drink suggestions" 
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[suggest-drink-pairings] Error:", error);
    return NextResponse.json(
      { error: "Failed to suggest drinks" },
      { status: 500 }
    );
  }
}

