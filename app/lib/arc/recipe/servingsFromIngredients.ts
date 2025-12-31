export type IngredientLine = {
  name: string
  quantity: number | null
  unit: string | null
  quantityInferred?: boolean
  unitInferred?: boolean
}

export type ServingsAnalysis = {
  servings: number | null
  assumption: "standalone_main_dinner"
  limitingIngredient?: string
  notes: string[]
  usedInferredQuantities: boolean
}

const UNIT_TO_G: Record<string, number> = {
  g: 1,
  kg: 1000,
  mg: 0.001,
}

const UNIT_TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
}

function normalizeUnit(u: string | null | undefined) {
  if (!u) return null
  return u.toLowerCase().replace(/\./g, "").trim()
}

function toGrams(qty: number | null, unit: string | null): number | null {
  if (qty == null) return null
  const u = normalizeUnit(unit)
  if (!u) return null
  if (UNIT_TO_G[u] != null) return qty * UNIT_TO_G[u]
  return null
}

function isPrimaryProtein(name: string) {
  return /chicken|beef|pork|lamb|fish|salmon|tuna|shrimp|prawn|tofu/i.test(name)
}

function isPrimaryCarb(name: string) {
  return /rice|pasta|noodle|noodles|potato|bread|bun|wrap/i.test(name)
}

function isSecondaryBulk(name: string) {
  return /lentil|beans|chickpea|chana|dal|onion|carrot|cabbage|cauliflower|broccoli/i.test(name)
}

function isMinor(name: string) {
  return /salt|pepper|spice|cumin|paprika|chili|oil|vinegar|sugar|soy sauce|sauce|garlic|ginger/i.test(name)
}

function perPersonStandardGrams(name: string): number | null {
  // Chef-realistic raw weights (very coarse; used only when grams are present)
  if (/chicken/i.test(name)) return 200
  if (/beef|lamb|pork/i.test(name)) return 200
  if (/fish|salmon|tuna/i.test(name)) return 180
  if (/tofu/i.test(name)) return 180
  if (/rice/i.test(name)) return 90
  if (/pasta|noodle/i.test(name)) return 100
  if (/potato/i.test(name)) return 275
  if (isSecondaryBulk(name)) return 120
  return null
}

export function computeServingsFromIngredients(input: {
  ingredients: IngredientLine[]
}): ServingsAnalysis {
  const notes: string[] = []
  const assumption: ServingsAnalysis["assumption"] = "standalone_main_dinner"

  const usedInferredQuantities = input.ingredients.some(
    (i) => i.quantityInferred || i.unitInferred
  )
  if (usedInferredQuantities) {
    notes.push("Some quantities/units were AI-added; servings may be approximate.")
  }

  const candidates = input.ingredients
    .map((ing) => {
      const grams = toGrams(ing.quantity, ing.unit)
      return { ing, grams }
    })
    .filter((x) => x.grams != null) as Array<{ ing: IngredientLine; grams: number }>

  const portionDefining = candidates.filter(
    ({ ing }) => isPrimaryProtein(ing.name) || isPrimaryCarb(ing.name) || isSecondaryBulk(ing.name)
  )

  if (portionDefining.length === 0) {
    return {
      servings: null,
      assumption,
      notes: ["No weight-based portion-defining ingredients found (need g/kg units).", ...notes],
      usedInferredQuantities,
    }
  }

  const servingsByIngredient = portionDefining
    .map(({ ing, grams }) => {
      const per = perPersonStandardGrams(ing.name)
      if (!per) return null
      const s = Math.floor(grams / per)
      return { name: ing.name, servings: s }
    })
    .filter(Boolean) as Array<{ name: string; servings: number }>

  if (servingsByIngredient.length === 0) {
    return {
      servings: null,
      assumption,
      notes: ["Could not apply portion standards to detected ingredients.", ...notes],
      usedInferredQuantities,
    }
  }

  const limiting = servingsByIngredient.reduce((a, b) => (b.servings < a.servings ? b : a))
  const servings = Math.max(1, limiting.servings)

  // Default context adjustment: standalone main dinner (no extra adjustment)
  notes.push("Assumption: standalone main dinner.")

  return {
    servings,
    assumption,
    limitingIngredient: limiting.name,
    notes,
    usedInferredQuantities,
  }
}






