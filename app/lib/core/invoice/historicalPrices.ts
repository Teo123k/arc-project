/**
 * Historical Price Learning
 * 
 * Silent backend capture of verified invoice prices.
 * NO UI, NO pricing usage, NO behavior changes.
 * 
 * This module captures price data for future learning without
 * affecting current pricing logic.
 */

import { HistoricalPriceEntry } from "../shared/types";
import { normalizeIngredientName } from "./normalize";
import { toCanonicalQuantity, CanonicalUnit } from "./units";
import { MatchConfidence } from "./matchInvoiceLine";

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE KEY
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "arc_historical_prices";
const MAX_ENTRIES = 10000; // Limit storage size

// ─────────────────────────────────────────────────────────────────────────────
// CAPTURE FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

export type CaptureParams = {
  ingredientName: string;
  unit: string;
  unitPrice: number;
  quantity?: number;
  currency: string;
  invoiceId: string;
  invoiceVendor?: string;
  invoiceDate?: string;
  region?: string;
  confidence: MatchConfidence;
};

/**
 * Capture a verified price for historical learning.
 * Only captures when confidence is not "none".
 * Silent operation - does not affect UI or pricing.
 */
export function captureHistoricalPrice(params: CaptureParams): void {
  // Only capture verified matches
  if (params.confidence === "none") {
    return;
  }

  // Normalize ingredient name
  const normalized = normalizeIngredientName(params.ingredientName);
  
  // Get canonical unit and price
  const canonical = toCanonicalQuantity(1, params.unit);
  if (!canonical) {
    // Cannot normalize unit - skip capture
    return;
  }

  // Calculate price per canonical unit
  const pricePerCanonicalUnit = params.unitPrice / canonical.quantity;

  const entry: HistoricalPriceEntry = {
    id: `hp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ingredientKey: normalized.key,
    ingredientOriginal: params.ingredientName,
    canonicalUnit: canonical.unit,
    pricePerCanonicalUnit,
    currency: params.currency,
    region: params.region,
    invoiceId: params.invoiceId,
    invoiceVendor: params.invoiceVendor,
    invoiceDate: params.invoiceDate,
    capturedAt: new Date().toISOString(),
  };

  // Save to storage (async, non-blocking)
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const existing = loadHistoricalPrices();
      
      // Dedupe: don't add if exact same invoice+ingredient exists
      const isDuplicate = existing.some(
        (e) => e.invoiceId === entry.invoiceId && e.ingredientKey === entry.ingredientKey
      );
      
      if (!isDuplicate) {
        const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
    }
  } catch (err) {
    // Silent failure - this is background learning
    console.debug("[HistoricalPrices] Capture failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// READ FUNCTIONS (for future use)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load all historical prices from storage.
 */
export function loadHistoricalPrices(): HistoricalPriceEntry[] {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as HistoricalPriceEntry[];
      }
    }
  } catch (err) {
    console.debug("[HistoricalPrices] Load failed:", err);
  }
  return [];
}

/**
 * Find historical prices for an ingredient.
 * Returns prices sorted by most recent first.
 */
export function findHistoricalPrices(
  ingredientName: string
): HistoricalPriceEntry[] {
  const normalized = normalizeIngredientName(ingredientName);
  const all = loadHistoricalPrices();
  
  return all
    .filter((e) => e.ingredientKey === normalized.key)
    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
}

/**
 * Get average historical price for an ingredient in a specific unit.
 * Returns null if no historical data or incompatible units.
 */
export function getAverageHistoricalPrice(
  ingredientName: string,
  unit: string,
  currency: string
): { price: number; samples: number } | null {
  const prices = findHistoricalPrices(ingredientName);
  
  if (prices.length === 0) {
    return null;
  }

  // Filter by currency
  const sameCurrency = prices.filter((p) => p.currency === currency);
  if (sameCurrency.length === 0) {
    return null;
  }

  // Check unit compatibility
  const targetCanonical = toCanonicalQuantity(1, unit);
  if (!targetCanonical) {
    return null;
  }

  // Filter by compatible unit type
  const compatible = sameCurrency.filter((p) => p.canonicalUnit === targetCanonical.unit);
  if (compatible.length === 0) {
    return null;
  }

  // Calculate average price per canonical unit
  const avgPerCanonical = compatible.reduce((sum, p) => sum + p.pricePerCanonicalUnit, 0) / compatible.length;
  
  // Convert back to target unit
  const priceInTargetUnit = avgPerCanonical * targetCanonical.quantity;

  return {
    price: Math.round(priceInTargetUnit * 100) / 100,
    samples: compatible.length,
  };
}

/**
 * Clear all historical prices (for testing/reset).
 */
export function clearHistoricalPrices(): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {
    console.debug("[HistoricalPrices] Clear failed:", err);
  }
}

