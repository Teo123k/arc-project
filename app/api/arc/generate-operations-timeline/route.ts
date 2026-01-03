import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate a professional chef's operations timeline for an event.
 * Considers recipes, prep time, kitchen situation, and event details.
 */
export async function POST(req: NextRequest) {
  try {
    const { 
      recipes, 
      guestCount, 
      eventDate,
      serviceStart,
      serviceEnd,
      location,
      kitchen,
      menuStyle,
      occasion
    } = await req.json();

    if (!recipes || !Array.isArray(recipes) || recipes.length === 0) {
      return NextResponse.json(
        { error: "Recipes array is required" },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a professional executive chef planning operations for a catering event.

Create a detailed operations timeline that a professional chef would use. Consider:
1. Prep work that can be done in advance (D-3, D-2, D-1)
2. Day-of tasks with specific times
3. Kitchen logistics (on-site vs. external)
4. Food safety (holding times, temperatures)
5. Team coordination
6. Transport if needed

Format the timeline from earliest prep to service completion.

Respond with ONLY valid JSON, no markdown. Format:
{
  "timeline": [
    {
      "day": "D-3" | "D-2" | "D-1" | "D-0",
      "time": "string (optional, e.g., '09:00', 'Morning')",
      "task": "string - specific task description",
      "duration": "string (e.g., '2 hours', '30 min')",
      "category": "prep" | "cooking" | "transport" | "setup" | "service" | "cleanup",
      "notes": "string (optional - chef tips)"
    }
  ],
  "criticalPath": [
    "string - key milestones that cannot be delayed"
  ],
  "teamRecommendation": {
    "minStaff": number,
    "idealStaff": number,
    "roles": ["string - recommended roles"]
  },
  "totalPrepHours": number,
  "riskPoints": [
    "string - potential bottlenecks or issues to watch"
  ]
}`;

    const recipeList = recipes.map((r: { name: string; prepTime?: number; course?: string }) => 
      `${r.name}${r.prepTime ? ` (${r.prepTime} min prep)` : ""}${r.course ? ` [${r.course}]` : ""}`
    ).join("\n");

    const kitchenInfo = kitchen ? 
      `Kitchen: ${kitchen.onSitePrep ? "On-site prep available" : "No on-site kitchen"}${kitchen.externalKitchen ? ", External kitchen" : ""}${kitchen.transportRequired ? ", Transport required" : ""}` :
      "Kitchen situation: Not specified";

    const userPrompt = `Event Details:
- Date: ${eventDate || "Not specified"}
- Service: ${serviceStart || "?"} to ${serviceEnd || "?"}
- Guests: ${guestCount || "Unknown"}
- Location: ${location || "Not specified"}
- Occasion: ${occasion || "Catering event"}
- Style: ${menuStyle === "buffet" ? "Buffet service" : menuStyle === "street_food" ? "Street food" : "Plated courses"}
- ${kitchenInfo}

Menu (${recipes.length} dishes):
${recipeList}

Create a professional chef's operations timeline for this event.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 2500,
    });

    const content = response.choices[0]?.message?.content?.trim() || "{}";

    let result: Record<string, unknown> = {};
    try {
      const cleaned = content.replace(/^```json?\n?|\n?```$/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error("[generate-operations-timeline] Failed to parse AI response:", content);
      return NextResponse.json({ 
        timeline: [],
        error: "Failed to generate timeline" 
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[generate-operations-timeline] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate operations timeline" },
      { status: 500 }
    );
  }
}

