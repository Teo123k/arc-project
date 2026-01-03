import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Estimate ingredient prices based on location and market research.
 * Returns price ranges and sourcing suggestions.
 */
export async function POST(req: NextRequest) {
  try {
    const { ingredients, location, currency = "LKR", guestCount } = await req.json();

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json(
        { error: "Ingredients array is required" },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a procurement expert helping a chef estimate ingredient costs for catering.

Given a list of ingredients and a location, provide realistic price estimates based on:
1. Local market prices
2. Seasonal availability
3. Quality tiers (budget, standard, premium)

For each ingredient, provide:
- name: Ingredient name
- quantity: Estimated quantity needed (with unit)
- priceRange: { low, mid, high } in the specified currency
- suggestedSource: Where to buy (market name, type of vendor)
- notes: Any tips for sourcing or substitutions

Also provide:
- marketTip: General advice about sourcing in this location
- totalEstimate: { low, mid, high } for all ingredients combined

Use realistic prices for the specified location and currency.
Respond with ONLY valid JSON, no markdown.`;

    const ingredientList = ingredients.map((ing: { name: string; quantity?: string; unit?: string }) => 
      `${ing.name}${ing.quantity ? ` (${ing.quantity} ${ing.unit || ""})` : ""}`
    ).join("\n");

    const userPrompt = `Location: ${location || "Sri Lanka"}
Currency: ${currency}
Guest count: ${guestCount || "Unknown"}

Ingredients to price:
${ingredientList}

Provide price estimates for each ingredient.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: 2500,
    });

    const content = response.choices[0]?.message?.content?.trim() || "{}";

    let result: Record<string, unknown> = {};
    try {
      const cleaned = content.replace(/^```json?\n?|\n?```$/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error("[estimate-ingredient-prices] Failed to parse AI response:", content);
      return NextResponse.json({ 
        items: [],
        error: "Failed to parse price estimates" 
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[estimate-ingredient-prices] Error:", error);
    return NextResponse.json(
      { error: "Failed to estimate prices" },
      { status: 500 }
    );
  }
}

