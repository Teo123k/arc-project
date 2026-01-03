/**
 * Invoice Line Matching
 * 
 * Deterministic matching of shopping list items to invoice lines.
 * NO fuzzy AI scoring — all matching is rule-based.
 */

import { normalizeUnit, areUnitsCompatible, toCanonicalQuantity } from "./units";
import { normalizeIngredientName, compareIngredientNames } from "./normalize";
import { areAliases, getCanonicalName } from "./aliases";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type MatchConfidence = "exact" | "unit-converted" | "alias" | "none";

export type InvoiceLineItem = {
  name: string;
  quantity?: number;
  unit?: string;
  unitPrice: number;
  totalPrice?: number;
};

export type InvoiceData = {
  id: string;
  vendor?: string;
  date?: string;
  items: InvoiceLineItem[];
};

export type MatchResult = {
  matched: boolean;
  confidence: MatchConfidence;
  invoiceLine: InvoiceLineItem | null;
  invoiceId: string | null;
  invoiceVendor: string | null;
  unitPrice: number | null;
  pricePerCanonicalUnit: number | null;  // Price per g/ml/each
  matchDetails: {
    nameMatch: boolean;
    unitMatch: boolean;
    aliasUsed: boolean;
    unitConverted: boolean;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// MATCHING LOGIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Match a shopping list item against all invoice lines.
 * Returns the best match with confidence level.
 */
export function matchInvoiceLine(
  ingredientName: string,
  ingredientUnit: string,
  invoices: InvoiceData[]
): MatchResult {
  const noMatch: MatchResult = {
    matched: false,
    confidence: "none",
    invoiceLine: null,
    invoiceId: null,
    invoiceVendor: null,
    unitPrice: null,
    pricePerCanonicalUnit: null,
    matchDetails: {
      nameMatch: false,
      unitMatch: false,
      aliasUsed: false,
      unitConverted: false,
    },
  };

  if (!invoices || invoices.length === 0) {
    return noMatch;
  }

  const normalizedIngredient = normalizeIngredientName(ingredientName);
  const ingredientCanonical = getCanonicalName(ingredientName);

  // Track best match
  let bestMatch: MatchResult | null = null;
  let bestConfidence: MatchConfidence = "none";

  for (const invoice of invoices) {
    if (!invoice.items) continue;

    for (const line of invoice.items) {
      if (!line.unitPrice || line.unitPrice <= 0) continue;

      const normalizedLine = normalizeIngredientName(line.name);
      const lineCanonical = getCanonicalName(line.name);

      // ───────────────────────────────────────────────────────────────────
      // STEP 1: Check name match
      // ───────────────────────────────────────────────────────────────────
      
      let nameMatch = false;
      let aliasUsed = false;

      // Exact normalized key match
      if (normalizedIngredient.key === normalizedLine.key) {
        nameMatch = true;
      }
      // Canonical alias match
      else if (ingredientCanonical === lineCanonical) {
        nameMatch = true;
        aliasUsed = true;
      }
      // Substring containment (one contains the other)
      else if (
        normalizedIngredient.key.includes(normalizedLine.key) ||
        normalizedLine.key.includes(normalizedIngredient.key)
      ) {
        nameMatch = true;
      }
      // Word overlap > 50%
      else if (compareIngredientNames(ingredientName, line.name) >= 0.5) {
        nameMatch = true;
      }
      // Direct alias check
      else if (areAliases(ingredientName, line.name)) {
        nameMatch = true;
        aliasUsed = true;
      }

      if (!nameMatch) continue;

      // ───────────────────────────────────────────────────────────────────
      // STEP 2: Check unit compatibility
      // ───────────────────────────────────────────────────────────────────
      
      let unitMatch = false;
      let unitConverted = false;

      const lineUnit = line.unit || "each";
      
      // Exact unit match
      const normalizedIngUnit = normalizeUnit(ingredientUnit);
      const normalizedLineUnit = normalizeUnit(lineUnit);
      
      if (normalizedIngUnit && normalizedLineUnit) {
        if (normalizedIngUnit.canonical === normalizedLineUnit.canonical) {
          unitMatch = true;
          if (normalizedIngUnit.multiplier !== normalizedLineUnit.multiplier) {
            unitConverted = true;
          }
        }
      } else {
        // If units can't be normalized, allow match if same string
        if (ingredientUnit.toLowerCase() === lineUnit.toLowerCase()) {
          unitMatch = true;
        }
      }

      // ───────────────────────────────────────────────────────────────────
      // STEP 3: Calculate confidence & price
      // ───────────────────────────────────────────────────────────────────
      
      let confidence: MatchConfidence = "none";
      
      if (nameMatch && unitMatch && !aliasUsed && !unitConverted) {
        confidence = "exact";
      } else if (nameMatch && unitMatch && unitConverted) {
        confidence = "unit-converted";
      } else if (nameMatch && aliasUsed) {
        confidence = "alias";
      } else if (nameMatch) {
        // Name matches but units don't — still useful
        confidence = "alias";
      }

      if (confidence === "none") continue;

      // Calculate canonical price if possible
      let pricePerCanonicalUnit: number | null = null;
      if (normalizedLineUnit) {
        pricePerCanonicalUnit = line.unitPrice / normalizedLineUnit.multiplier;
      }

      // ───────────────────────────────────────────────────────────────────
      // STEP 4: Compare with current best
      // ───────────────────────────────────────────────────────────────────
      
      const confidenceRank: Record<MatchConfidence, number> = {
        "exact": 3,
        "unit-converted": 2,
        "alias": 1,
        "none": 0,
      };

      if (confidenceRank[confidence] > confidenceRank[bestConfidence]) {
        bestConfidence = confidence;
        bestMatch = {
          matched: true,
          confidence,
          invoiceLine: line,
          invoiceId: invoice.id,
          invoiceVendor: invoice.vendor || null,
          unitPrice: line.unitPrice,
          pricePerCanonicalUnit,
          matchDetails: {
            nameMatch,
            unitMatch,
            aliasUsed,
            unitConverted,
          },
        };
      }
    }
  }

  return bestMatch || noMatch;
}

/**
 * Match all shopping list items against invoices.
 * Returns a map of ingredient keys to match results.
 */
export function matchAllIngredients(
  ingredients: Array<{ name: string; unit: string }>,
  invoices: InvoiceData[]
): Map<string, MatchResult> {
  const results = new Map<string, MatchResult>();

  for (const ingredient of ingredients) {
    const key = `${ingredient.name.toLowerCase()}::${ingredient.unit.toLowerCase()}`;
    const match = matchInvoiceLine(ingredient.name, ingredient.unit, invoices);
    results.set(key, match);
  }

  return results;
}

