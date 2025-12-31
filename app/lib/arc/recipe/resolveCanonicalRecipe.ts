export type CanonicalRecipe = {
  id: string
  title: string

  cuisine?: {
    value: string
    confidence: number
  }

  occasion?: {
    value: string
    confidence: number
  }

  servings: {
    value: number | null
    unit: "people" | "portions"
    inferred: boolean
    confidence: number
  }

  ingredients: Array<{
    name: string
    quantity: number | null
    unit: string | null
    preparation?: string
    category?: "fresh" | "dry" | "other"
  }>

  steps: Array<{
    order: number
    instruction: string
  }>

  notes?: string[]

  completeness: {
    chefUsable: boolean
    costingReady: boolean
  }

  provenance: {
    sources: Array<"ocr" | "ai" | "user">
    overallConfidence: number
  }
}

type StructuredValue<T> = {
  value: T
  confidence: number
  source?: "ocr" | "ai" | "user"
}

type RecipeIntelligenceLike = {
  recipeNameStructured?: StructuredValue<string>
  cuisineStructured?: StructuredValue<string>
  occasionStructured?: StructuredValue<string>
  ingredients?: Array<{
    name: string
    quantity?: number
    unit?: string
    confidence?: number
    category?: "fresh" | "dry" | "other"
  }>
  steps?: Array<{
    order: number
    instruction: string
    confidence?: number
  }>
  servingsAnalysis?: {
    servings: number | null
  }
}

function clampConfidence(value: number | undefined): number {
  if (typeof value !== "number") return 0.5
  return Math.max(0, Math.min(1, value))
}

function inferIngredientCategory(name: string): "fresh" | "dry" | "other" {
  const lower = name.toLowerCase()
  // Fresh: produce, meat, fish, dairy, herbs
  if (/\b(chicken|beef|pork|lamb|fish|salmon|tuna|shrimp|prawn|egg|milk|cream|butter|cheese|yogurt|tofu|tomato|onion|garlic|ginger|carrot|celery|pepper|lettuce|spinach|cabbage|broccoli|mushroom|apple|lemon|lime|orange|banana|berry|herb|basil|cilantro|parsley|mint|thyme|rosemary|dill|chive|scallion)\b/i.test(lower)) {
    return "fresh"
  }
  // Dry: flour, sugar, spices, grains, dried goods, oils, vinegars, sauces, canned
  if (/\b(flour|sugar|salt|pepper|spice|cumin|paprika|cinnamon|turmeric|curry|chili|rice|pasta|noodle|bread|oil|vinegar|soy sauce|sauce|stock|broth|water|wine|honey|syrup|jam|can|dried|powder|baking)\b/i.test(lower)) {
    return "dry"
  }
  return "other"
}

function inferServingsFromIngredients(
  ingredients: CanonicalRecipe["ingredients"]
): CanonicalRecipe["servings"] {
  if (!ingredients.length) {
    return {
      value: null,
      unit: "portions",
      inferred: true,
      confidence: 0.3,
    }
  }

  const proteinLike = ingredients.filter(i =>
    /chicken|beef|pork|fish|tofu|lamb/i.test(i.name)
  )

  if (proteinLike.length >= 2) {
    return {
      value: 4,
      unit: "people",
      inferred: true,
      confidence: 0.5,
    }
  }

  return {
    value: 2,
    unit: "people",
    inferred: true,
    confidence: 0.4,
  }
}

function extractStepsFromRawText(extractedText: string): CanonicalRecipe["steps"] {
  const lines = extractedText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) return []

  const isHeading = (l: string) =>
    /^(ingredients?|method|instructions|directions|preparation|procedure|steps?)\b[:\-]?\s*$/i.test(l)

  const isIngredientsHeading = (l: string) => /^ingredients?\b/i.test(l)

  const isLikelyIngredientLine = (l: string) =>
    // bullets, quantities, or typical ingredient patterns
    /^(\-|\•|\*|\d+\s*[\)\.])\s*/.test(l) ||
    /^\d+(\.\d+)?\s*(g|kg|mg|ml|l|tsp|tbsp|cup|cups|oz|lb|lbs|pcs|pc)\b/i.test(l)

  const instructionHeaderIdx = lines.findIndex((l) =>
    /^(method|instructions|directions|preparation|procedure|steps?)\b/i.test(l)
  )

  let candidates = instructionHeaderIdx >= 0 ? lines.slice(instructionHeaderIdx + 1) : lines.slice()

  // If we started from the top, try to skip an ingredients section if present.
  if (instructionHeaderIdx < 0) {
    const ingredientsIdx = lines.findIndex(isIngredientsHeading)
    if (ingredientsIdx >= 0) {
      // find the first non-ingredient-looking line after the ingredients header
      const after = lines.slice(ingredientsIdx + 1)
      const firstNonIngredient = after.findIndex((l) => !isHeading(l) && !isLikelyIngredientLine(l))
      if (firstNonIngredient >= 0) candidates = after.slice(firstNonIngredient)
    }
  }

  const cleaned = candidates
    .filter((l) => !isHeading(l))
    .map((l) => l.replace(/^\s*(\d+[\)\.]|\-|\•|\*)\s+/, "").trim())
    .filter((l) => l.length >= 3)

  // Cap to prevent runaway OCR noise, but keep far more than 20 lines.
  const capped = cleaned.slice(0, 200)

  return capped.map((instruction, index) => ({
    order: index + 1,
    instruction,
  }))
}

export function resolveCanonicalRecipe(input: {
  id: string
  extractedText?: string | null
  recipeIntelligence?: RecipeIntelligenceLike
  fallbackTitle?: string
}): CanonicalRecipe {
  const ri = input.recipeIntelligence

  const title =
    (ri?.recipeNameStructured &&
      ri.recipeNameStructured.confidence >= 0.7 &&
      ri.recipeNameStructured.value) ||
    input.fallbackTitle ||
    "Untitled Recipe"

  const ingredients =
    ri?.ingredients?.map(i => ({
      name: i.name,
      quantity: typeof i.quantity === "number" ? i.quantity : null,
      unit: i.unit ?? null,
      category: i.category ?? inferIngredientCategory(i.name),
    })) ?? []

  const steps: CanonicalRecipe["steps"] =
    ri?.steps?.length
      ? ri.steps
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((s, i) => ({
            order: typeof s.order === "number" ? s.order : i + 1,
            instruction: String(s.instruction || "").trim(),
          }))
          .filter((s) => s.instruction.length > 0)
      : input.extractedText
      ? extractStepsFromRawText(input.extractedText)
      : []

  const servings = inferServingsFromIngredients(ingredients)
  const computedServings =
    typeof ri?.servingsAnalysis?.servings === "number"
      ? ri.servingsAnalysis.servings
      : null

  const chefUsable = ingredients.length > 0 && steps.length > 0
  const costingReady = ingredients.every(
    i => i.quantity !== null && i.unit !== null
  )

  const confidenceSignals = [
    ri?.recipeNameStructured?.confidence,
    ri?.cuisineStructured?.confidence,
    ri?.occasionStructured?.confidence,
  ].map(clampConfidence)

  const overallConfidence =
    confidenceSignals.reduce((a, b) => a + b, 0) /
    Math.max(1, confidenceSignals.length)

  return {
    id: input.id,
    title,
    cuisine: ri?.cuisineStructured
      ? {
          value: ri.cuisineStructured.value,
          confidence: clampConfidence(ri.cuisineStructured.confidence),
        }
      : undefined,
    occasion: ri?.occasionStructured
      ? {
          value: ri.occasionStructured.value,
          confidence: clampConfidence(ri.occasionStructured.confidence),
        }
      : undefined,
    servings: computedServings !== null
      ? { value: computedServings, unit: "people", inferred: false, confidence: 0.7 }
      : servings,
    ingredients,
    steps,
    completeness: {
      chefUsable,
      costingReady,
    },
    provenance: {
      sources: [
        ri?.recipeNameStructured?.source,
        ri?.cuisineStructured?.source,
        ri?.occasionStructured?.source,
      ].filter(Boolean) as Array<"ocr" | "ai" | "user">,
      overallConfidence: clampConfidence(overallConfidence),
    },
  }
}



