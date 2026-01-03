import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Extract structured event details from OCR text / user notes.
 * Used to auto-populate the Clarify phase fields.
 */
export async function POST(req: NextRequest) {
  try {
    console.log("[extract-event-details] route hit");
    const { text, existingDetails } = await req.json();
    console.log(
      "[extract-event-details] input text length =",
      text?.length ?? 0
    );
    console.log(
      "📥 [extract-event-details] received text length:",
      text?.length ?? 0
    );

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ details: existingDetails || {} });
    }

    const systemPrompt = `You are an AI assistant helping a professional chef extract event details from client briefs, emails, or notes.

Extract the following fields if mentioned (leave null if not found):
- eventName: A short, human-friendly name for the event. Use client names, company names, or occasion if present. Examples: "Johnson Wedding", "Acme Corp Holiday Party", "Private Birthday Dinner"
- occasion: Type of event (e.g., "Wedding", "Corporate event", "Birthday party", "Private dinner", "Pop-up event", "Anniversary dinner")
- guests: Number of guests (integer)
- location: Venue or location name/address
- date: Event date (ISO format YYYY-MM-DD if possible, or natural language)
- serviceStart: Service start time (HH:MM format)
- serviceEnd: Service end time (HH:MM format)
- pricingModel: Either "per_head" or "event_total"
- priceAmount: Budget amount (number)
- currency: Currency code (e.g., "USD", "EUR", "GBP", "LKR")
- multiDay: true if the event spans multiple days
- numberOfDays: Number of days if multi-day event
- menuStyle: Type of service ("course_meal", "buffet", "street_food", or null)
- dietaryRequirements: Array of dietary requirements mentioned (e.g., ["vegetarian", "gluten-free"])
- constraints: Array of constraints or special requirements (e.g., "no shellfish", "kosher", "outdoor setup")
- unknowns: Array of things that need clarification or are missing
- notes: Any additional notes, comments, or context that should be preserved (as a string)
- kitchen: Kitchen situation object with these boolean fields:
  - onSitePrep: true if on-site kitchen/prep is available
  - externalKitchen: true if external/commissary kitchen is required
  - transportRequired: true if food transport is needed
- staffCount: Number of staff mentioned (integer)
- seatingStyle: Seating arrangement (e.g., "banquet", "cocktail", "theater", "classroom", "family-style")

If a field is not clearly stated, omit it. Do not invent details.

Respond with ONLY valid JSON, no markdown.`;

    const userPrompt = `Extract event details from this text:

"""
${text.slice(0, 8000)}
"""

${existingDetails ? `\nExisting details (preserve if not contradicted):\n${JSON.stringify(existingDetails)}` : ""}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content?.trim() || "{}";

    // Parse JSON response
    let extracted: Record<string, unknown> = {};
    try {
      // Remove markdown code fences if present
      const cleaned = content.replace(/^```json?\n?|\n?```$/g, "").trim();
      extracted = JSON.parse(cleaned);
    } catch {
      console.error("[extract-event-details] Failed to parse AI response:", content);
      return NextResponse.json({ details: existingDetails || {} });
    }

    // Merge with existing details, preferring new extractions for non-null values
    const merged: Record<string, unknown> = { ...(existingDetails || {}) };

    // Map extracted fields to our EventDetails structure
    if (extracted.eventName) merged.eventName = extracted.eventName;
    if (extracted.occasion) merged.occasion = extracted.occasion;
    if (extracted.guests && typeof extracted.guests === "number") merged.guests = extracted.guests;
    if (extracted.location) merged.location = extracted.location;
    if (extracted.date) merged.date = extracted.date;
    if (extracted.serviceStart) merged.serviceStart = extracted.serviceStart;
    if (extracted.serviceEnd) merged.serviceEnd = extracted.serviceEnd;
    if (extracted.pricingModel) merged.pricingModel = extracted.pricingModel;
    if (extracted.priceAmount && typeof extracted.priceAmount === "number") merged.priceAmount = extracted.priceAmount;
    if (extracted.currency) merged.currency = extracted.currency;

    // Multi-day event info
    if (extracted.multiDay) merged.multiDay = extracted.multiDay;
    if (extracted.numberOfDays) merged.numberOfDays = extracted.numberOfDays;
    if (extracted.menuStyle) merged.menuStyle = extracted.menuStyle;

    // Kitchen situation
    if (extracted.kitchen && typeof extracted.kitchen === "object") {
      merged.kitchen = extracted.kitchen;
    }

    // Seating and staff
    if (extracted.seatingStyle) merged.seatingStyle = extracted.seatingStyle;
    if (extracted.staffCount && typeof extracted.staffCount === "number") merged.staffCount = extracted.staffCount;

    // Additional metadata
    const unknowns = Array.isArray(extracted.unknowns) ? extracted.unknowns : [];
    const constraints = Array.isArray(extracted.constraints) ? extracted.constraints : [];
    const dietaryRequirements = Array.isArray(extracted.dietaryRequirements) ? extracted.dietaryRequirements : [];
    const notes = typeof extracted.notes === "string" ? extracted.notes : "";

    return NextResponse.json({
      details: merged,
      unknowns,
      constraints,
      dietaryRequirements,
      notes,
    });
  } catch (error) {
    console.error("[extract-event-details] Error:", error);
    return NextResponse.json(
      { error: "Failed to extract event details" },
      { status: 500 }
    );
  }
}





