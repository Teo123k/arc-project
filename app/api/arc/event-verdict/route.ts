import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type EventVerdict = "proceed" | "adjust" | "decline";

interface EventSummary {
  name: string;
  occasion?: string;
  guests?: number;
  location?: string;
  date?: string;
  budget?: number;
  currency?: string;
  menuRecipeCount: number;
  totalCost: number;
  margin?: number;
  highRisks: string[];
  unknowns: string[];
  constraints: string[];
}

/**
 * AI-driven event feasibility analysis.
 * Returns a verdict (proceed/adjust/decline) with reasoning and improvement suggestions.
 */
export async function POST(req: NextRequest) {
  try {
    const eventSummary: EventSummary = await req.json();

    const systemPrompt = `You are an experienced executive chef and event consultant. 
Analyze this catering event proposal and provide a professional assessment.

Your response MUST be valid JSON with this structure:
{
  "verdict": "proceed" | "adjust" | "decline",
  "confidence": number (0-100),
  "summary": "One sentence summary of your decision",
  "reasoning": ["Array of key factors that led to this decision"],
  "improvements": ["Specific actionable improvements if verdict is adjust or decline"],
  "warnings": ["Important considerations even if proceeding"],
  "profitabilityAssessment": "Brief assessment of financial viability"
}

Decision criteria:
- PROCEED: Event is well-planned, financially viable, risks are manageable
- ADJUST: Event is feasible but needs modifications to budget, scope, or logistics
- DECLINE: Event has fundamental issues (unrealistic budget, high risks, insufficient info)

Be direct and professional. If recommending decline, always provide a path to improvement.`;

    const userPrompt = `Analyze this event:

Event: ${eventSummary.name}
Occasion: ${eventSummary.occasion || "Not specified"}
Guests: ${eventSummary.guests || "Not confirmed"}
Location: ${eventSummary.location || "Not specified"}
Date: ${eventSummary.date || "Not confirmed"}
Budget: ${eventSummary.budget ? `${eventSummary.currency || "USD"} ${eventSummary.budget}` : "Not confirmed"}

Menu: ${eventSummary.menuRecipeCount} recipes planned
Estimated Cost: ${eventSummary.currency || "USD"} ${eventSummary.totalCost}
${eventSummary.margin ? `Estimated Margin: ${eventSummary.margin}%` : "Margin: Not calculated"}

High Risks: ${eventSummary.highRisks.length > 0 ? eventSummary.highRisks.join(", ") : "None identified"}
Unknowns: ${eventSummary.unknowns.length > 0 ? eventSummary.unknowns.join(", ") : "None"}
Constraints: ${eventSummary.constraints.length > 0 ? eventSummary.constraints.join(", ") : "None"}

Provide your professional verdict.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content?.trim() || "{}";

    // Parse JSON response
    let analysis: {
      verdict: EventVerdict;
      confidence: number;
      summary: string;
      reasoning: string[];
      improvements: string[];
      warnings: string[];
      profitabilityAssessment: string;
    };

    try {
      const cleaned = content.replace(/^```json?\n?|\n?```$/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      console.error("[event-verdict] Failed to parse AI response:", content);
      // Fallback based on simple heuristics
      const hasHighRisks = eventSummary.highRisks.length > 0;
      const hasBudget = !!eventSummary.budget;
      const hasMenu = eventSummary.menuRecipeCount > 0;
      
      if (hasHighRisks) {
        analysis = {
          verdict: "adjust",
          confidence: 60,
          summary: "Event has identified risks that should be addressed before proceeding.",
          reasoning: ["High risks flagged in the assessment"],
          improvements: eventSummary.highRisks.map(r => `Address risk: ${r}`),
          warnings: [],
          profitabilityAssessment: hasBudget ? "Budget confirmed but risks may impact profitability" : "Budget not confirmed",
        };
      } else if (!hasBudget || !hasMenu) {
        analysis = {
          verdict: "adjust",
          confidence: 50,
          summary: "Key information missing - budget or menu not fully defined.",
          reasoning: ["Incomplete event planning"],
          improvements: [
            ...(!hasBudget ? ["Confirm budget with client"] : []),
            ...(!hasMenu ? ["Complete menu design"] : []),
          ],
          warnings: [],
          profitabilityAssessment: "Cannot assess without complete information",
        };
      } else {
        analysis = {
          verdict: "proceed",
          confidence: 75,
          summary: "Event appears ready to proceed.",
          reasoning: ["Budget confirmed", "Menu designed", "No high risks identified"],
          improvements: [],
          warnings: [],
          profitabilityAssessment: "Appears financially viable",
        };
      }
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("[event-verdict] Error:", error);
    return NextResponse.json(
      { error: "Failed to analyze event" },
      { status: 500 }
    );
  }
}





