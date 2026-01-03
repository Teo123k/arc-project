import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Suggest recipe ideas based on selected ingredients.
 * Used for ingredient-first menu planning.
 */
export async function POST(req: NextRequest) {
  try {
    const { ingredients, occasion, guestCount, menuStyle, courseType, existingRecipes } = await req.json();

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json(
        { error: "At least one ingredient is required" },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a professional chef and culinary consultant helping plan a catering menu.

Given a list of available ingredients, suggest creative recipe ideas that:
1. Feature the provided ingredients prominently
2. Are suitable for professional catering (scalable, can be prepped ahead)
3. Match the occasion and service style
4. Balance flavors, textures, and visual appeal

For each recipe suggestion, provide:
- name: Descriptive recipe name
- course: "starter" | "main" | "dessert" | "side" | "beverage"
- description: Brief description (1-2 sentences)
- keyIngredients: Array of main ingredients used
- prepComplexity: "simple" | "moderate" | "complex"
- servingStyle: How it would be served (plated, family-style, buffet-friendly, etc.)

Respond with ONLY valid JSON, no markdown. Format:
{
  "suggestions": [
    {
      "name": "...",
      "course": "...",
      "description": "...",
      "keyIngredients": ["..."],
      "prepComplexity": "...",
      "servingStyle": "..."
    }
  ],
  "menuTip": "Optional tip about how these dishes work together"
}`;

    const userPrompt = `Available ingredients: ${ingredients.join(", ")}

Occasion: ${occasion || "Catering event"}
Guest count: ${guestCount || "Unknown"}
Menu style: ${menuStyle === "buffet" ? "Buffet service" : menuStyle === "street_food" ? "Street food style" : "Plated course meal"}
${courseType ? `Focus on: ${courseType} dishes` : "Suggest dishes for all courses"}
${existingRecipes?.length > 0 ? `Already planned: ${existingRecipes.join(", ")}` : ""}

Suggest 6-10 creative recipe ideas using these ingredients.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content?.trim() || "{}";

    let result: Record<string, unknown> = {};
    try {
      const cleaned = content.replace(/^```json?\n?|\n?```$/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error("[suggest-recipes-from-ingredients] Failed to parse AI response:", content);
      return NextResponse.json({ 
        suggestions: [],
        error: "Failed to parse recipe suggestions" 
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[suggest-recipes-from-ingredients] Error:", error);
    return NextResponse.json(
      { error: "Failed to suggest recipes" },
      { status: 500 }
    );
  }
}

