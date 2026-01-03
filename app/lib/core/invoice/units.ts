/**
 * Unit Normalization & Conversion
 * 
 * Deterministic unit handling for invoice matching.
 * NO density guessing, NO food-specific assumptions, NO AI inference.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL UNITS
// ─────────────────────────────────────────────────────────────────────────────

export type CanonicalUnit = "g" | "ml" | "each";

// ─────────────────────────────────────────────────────────────────────────────
// UNIT ALIASES → Canonical mapping
// ─────────────────────────────────────────────────────────────────────────────

const UNIT_ALIASES: Record<string, { canonical: CanonicalUnit; multiplier: number }> = {
  // Weight units → grams
  "g": { canonical: "g", multiplier: 1 },
  "gram": { canonical: "g", multiplier: 1 },
  "grams": { canonical: "g", multiplier: 1 },
  "gm": { canonical: "g", multiplier: 1 },
  "kg": { canonical: "g", multiplier: 1000 },
  "kilogram": { canonical: "g", multiplier: 1000 },
  "kilograms": { canonical: "g", multiplier: 1000 },
  "kilo": { canonical: "g", multiplier: 1000 },
  "lb": { canonical: "g", multiplier: 453.592 },
  "lbs": { canonical: "g", multiplier: 453.592 },
  "pound": { canonical: "g", multiplier: 453.592 },
  "pounds": { canonical: "g", multiplier: 453.592 },
  "oz": { canonical: "g", multiplier: 28.3495 },
  "ounce": { canonical: "g", multiplier: 28.3495 },
  "ounces": { canonical: "g", multiplier: 28.3495 },

  // Volume units → milliliters
  "ml": { canonical: "ml", multiplier: 1 },
  "milliliter": { canonical: "ml", multiplier: 1 },
  "milliliters": { canonical: "ml", multiplier: 1 },
  "l": { canonical: "ml", multiplier: 1000 },
  "liter": { canonical: "ml", multiplier: 1000 },
  "liters": { canonical: "ml", multiplier: 1000 },
  "litre": { canonical: "ml", multiplier: 1000 },
  "litres": { canonical: "ml", multiplier: 1000 },
  "cl": { canonical: "ml", multiplier: 10 },
  "centiliter": { canonical: "ml", multiplier: 10 },
  "dl": { canonical: "ml", multiplier: 100 },
  "deciliter": { canonical: "ml", multiplier: 100 },
  "fl oz": { canonical: "ml", multiplier: 29.5735 },
  "fluid ounce": { canonical: "ml", multiplier: 29.5735 },
  "cup": { canonical: "ml", multiplier: 236.588 },
  "cups": { canonical: "ml", multiplier: 236.588 },
  "tbsp": { canonical: "ml", multiplier: 14.787 },
  "tablespoon": { canonical: "ml", multiplier: 14.787 },
  "tablespoons": { canonical: "ml", multiplier: 14.787 },
  "tsp": { canonical: "ml", multiplier: 4.929 },
  "teaspoon": { canonical: "ml", multiplier: 4.929 },
  "teaspoons": { canonical: "ml", multiplier: 4.929 },

  // Count units → each
  "each": { canonical: "each", multiplier: 1 },
  "ea": { canonical: "each", multiplier: 1 },
  "pcs": { canonical: "each", multiplier: 1 },
  "pc": { canonical: "each", multiplier: 1 },
  "piece": { canonical: "each", multiplier: 1 },
  "pieces": { canonical: "each", multiplier: 1 },
  "unit": { canonical: "each", multiplier: 1 },
  "units": { canonical: "each", multiplier: 1 },
  "bunch": { canonical: "each", multiplier: 1 },
  "bunches": { canonical: "each", multiplier: 1 },
  "head": { canonical: "each", multiplier: 1 },
  "heads": { canonical: "each", multiplier: 1 },
  "clove": { canonical: "each", multiplier: 1 },
  "cloves": { canonical: "each", multiplier: 1 },
  "can": { canonical: "each", multiplier: 1 },
  "cans": { canonical: "each", multiplier: 1 },
  "bottle": { canonical: "each", multiplier: 1 },
  "bottles": { canonical: "each", multiplier: 1 },
  "packet": { canonical: "each", multiplier: 1 },
  "packets": { canonical: "each", multiplier: 1 },
  "pack": { canonical: "each", multiplier: 1 },
  "packs": { canonical: "each", multiplier: 1 },
  "box": { canonical: "each", multiplier: 1 },
  "boxes": { canonical: "each", multiplier: 1 },
  "bag": { canonical: "each", multiplier: 1 },
  "bags": { canonical: "each", multiplier: 1 },
  "jar": { canonical: "each", multiplier: 1 },
  "jars": { canonical: "each", multiplier: 1 },
  "tin": { canonical: "each", multiplier: 1 },
  "tins": { canonical: "each", multiplier: 1 },
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

export type NormalizedUnit = {
  canonical: CanonicalUnit;
  multiplier: number;
  original: string;
};

/**
 * Normalize a unit string to its canonical form.
 * Returns null if unit is unknown (no guessing).
 */
export function normalizeUnit(unit: string): NormalizedUnit | null {
  const cleaned = unit.toLowerCase().trim();
  const mapping = UNIT_ALIASES[cleaned];
  
  if (!mapping) {
    return null;
  }
  
  return {
    canonical: mapping.canonical,
    multiplier: mapping.multiplier,
    original: unit,
  };
}

/**
 * Convert a quantity from one unit to another.
 * Returns null if conversion is unsafe (incompatible unit types).
 */
export function convertUnit(
  quantity: number,
  fromUnit: string,
  toUnit: string
): { quantity: number; unit: CanonicalUnit } | null {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  
  if (!from || !to) {
    return null;
  }
  
  // Cannot convert between different canonical types (e.g., g to ml)
  if (from.canonical !== to.canonical) {
    return null;
  }
  
  // Convert: fromQty * fromMultiplier / toMultiplier
  const convertedQuantity = (quantity * from.multiplier) / to.multiplier;
  
  return {
    quantity: Math.round(convertedQuantity * 1000) / 1000, // 3 decimal precision
    unit: to.canonical,
  };
}

/**
 * Check if two units are compatible (same canonical type).
 */
export function areUnitsCompatible(unitA: string, unitB: string): boolean {
  const a = normalizeUnit(unitA);
  const b = normalizeUnit(unitB);
  
  if (!a || !b) {
    return false;
  }
  
  return a.canonical === b.canonical;
}

/**
 * Get the canonical quantity (converted to base unit).
 */
export function toCanonicalQuantity(
  quantity: number,
  unit: string
): { quantity: number; unit: CanonicalUnit } | null {
  const normalized = normalizeUnit(unit);
  
  if (!normalized) {
    return null;
  }
  
  return {
    quantity: quantity * normalized.multiplier,
    unit: normalized.canonical,
  };
}

