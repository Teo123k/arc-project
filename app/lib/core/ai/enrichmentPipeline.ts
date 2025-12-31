export type EnrichmentFileKeyLike = {
  id?: string;
  name: string;
  size: number;
  lastModified?: number;
};

export function getEnrichmentFileKey(
  file: EnrichmentFileKeyLike,
  kind: "enrich" | "cuisine"
) {
  return `${kind}:${file.id || `${file.name}-${file.size}-${file.lastModified ?? 0}`}`;
}

export function isCoolingDown(
  cooldownUntil: Map<string, number>,
  key: string
) {
  const until = cooldownUntil.get(key);
  return typeof until === "number" && until > Date.now();
}

export function noteFailure(input: {
  key: string;
  err: unknown;
  retryAfterMs?: number;
  lastErrorLogAt: Map<string, number>;
  backoffMs: Map<string, number>;
  cooldownUntil: Map<string, number>;
}) {
  const { key, err, retryAfterMs, lastErrorLogAt, backoffMs, cooldownUntil } = input;

  const now = Date.now();
  const last = lastErrorLogAt.get(key) ?? 0;
  if (now - last > 10_000) {
    lastErrorLogAt.set(key, now);
    console.warn("ARC enrichment delayed (cooldown):", key, err);
  }

  const prev = backoffMs.get(key) ?? 0;
  const base =
    typeof retryAfterMs === "number" && retryAfterMs > 0 ? retryAfterMs : prev || 10_000;
  const next = Math.min(Math.max(base, 5_000) * 2, 60_000);
  backoffMs.set(key, next);
  cooldownUntil.set(key, now + next);
}

export function buildCuisineDietaryPrompt(input: {
  name: string;
  ingredients: { name?: string }[];
}) {
  return `
You are a culinary assistant.

Given this recipe:
Name: ${input.name}
Ingredients: ${input.ingredients.map((i) => i.name).join(", ")}

Infer the cuisine and dietary tags ONLY if you are confident.

Respond in JSON ONLY with this shape:
{
  "cuisine": string | null,
  "dietary": string[] | null
}

If unsure, return null values.
`;
}

export function buildValidateClassificationPrompt(input: {
  name: string;
  ingredients: { name?: string }[];
}) {
  return `
You are validating a chef recipe classification.

Recipe name: ${input.name}
Ingredients: ${input.ingredients.map((i) => i.name).join(", ")}

Determine ONLY if you are confident:
- dishCategory: starter | main | dessert | other | null
- cuisine: string | null
- dietary: string[] | null

Respond ONLY in JSON:
{
  "dishCategory": string | null,
  "cuisine": string | null,
  "dietary": string[] | null,
  "confidence": number
}

If unsure, return nulls and low confidence.
`;
}

export function buildStructuredRecipeExtractionPrompt(recipeText: string) {
  return `
You are extracting structured data from a chef recipe.

Return STRICT JSON only (no markdown, no explanation).

Schema:
{
  "recipeName": string,
  "dishCategory": "starter" | "main" | "dessert" | "other",
  "dishStyle": string,
  "cuisine": string,
  "dietary": string[],
  "servingsText": string | null,
  "ingredients": Array<{ "name": string, "quantity": number | null, "unit": string | null, "preparation"?: string | null, "quantityInferred": boolean, "unitInferred": boolean, "category": "fresh" | "dry" | "other" }>,
  "steps": Array<string>
}

Rules:
- If unsure, leave field empty and set needsReview=true.
- Never invent a recipe name if the text is not enough.
- Ingredients must be actual ingredient lines (exclude headings like "Ingredients:").
- Steps must be imperative instructions (exclude ingredient lines).
- Keep arrays compact; do not include blank items.
- If an ingredient has missing quantity/unit, you MAY suggest a best-guess quantity/unit and set quantityInferred/unitInferred=true.
- If you do infer quantity/unit, keep it conservative and chef-realistic (professional kitchen), and prefer common units (g, kg, ml, L, pcs).
- For "category": use "fresh" for produce, meat, fish, dairy, herbs, etc. Use "dry" for flour, sugar, spices, grains, dried goods, oils, vinegars, sauces, canned items. Use "other" if unclear.

Recipe text:
${recipeText}
`;
}

export function parseStrictJsonFromReply(rawText: unknown) {
  if (typeof rawText !== "string") return null;
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

export function parseJsonObjectFromReply(raw: unknown) {
  if (typeof raw !== "string") return null;
  if (!raw) return null;

  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
  return parsed;
}

export function extractStructuredRecipeFields(parsed: any) {
  const recipeName =
    typeof parsed?.recipeName === "string" ? parsed.recipeName.trim() : "";
  const dishCategory =
    typeof parsed?.dishCategory === "string" ? parsed.dishCategory : undefined;
  const dishStyle =
    typeof parsed?.dishStyle === "string" ? parsed.dishStyle.trim() : "";
  const cuisine =
    typeof parsed?.cuisine === "string" ? parsed.cuisine.trim() : "";
  const dietary =
    Array.isArray(parsed?.dietary)
      ? parsed.dietary.filter((x: any) => typeof x === "string")
      : [];

  // servingsText currently unused; kept for forward compatibility
  const servingsText =
    typeof parsed?.servingsText === "string" ? parsed.servingsText.trim() : "";

  const ingredientsRaw = Array.isArray(parsed?.ingredients) ? parsed.ingredients : [];
  const ingredients = ingredientsRaw
    .map((ing: any) => {
      const name = typeof ing?.name === "string" ? ing.name.trim() : "";
      const quantity =
        typeof ing?.quantity === "number"
          ? ing.quantity
          : ing?.quantity == null
          ? null
          : Number.isFinite(Number(ing.quantity))
          ? Number(ing.quantity)
          : null;
      const unit = typeof ing?.unit === "string" ? ing.unit.trim() : null;
      const preparation =
        typeof ing?.preparation === "string" ? ing.preparation.trim() : undefined;
      const quantityInferred = Boolean(ing?.quantityInferred);
      const unitInferred = Boolean(ing?.unitInferred);
      if (!name) return null;
      return {
        name,
        quantity,
        unit,
        preparation,
        confidence: 0.6,
        quantityInferred,
        unitInferred,
      };
    })
    .filter(Boolean);

  const stepsRaw = Array.isArray(parsed?.steps) ? parsed.steps : [];
  const steps = stepsRaw
    .map((s: any, idx: number) => {
      const instruction = typeof s === "string" ? s.trim() : "";
      if (!instruction) return null;
      return { order: idx + 1, instruction, confidence: 0.6 };
    })
    .filter(Boolean);

  return {
    recipeName,
    dishCategory,
    dishStyle,
    cuisine,
    dietary,
    servingsText,
    ingredients,
    steps,
  };
}


