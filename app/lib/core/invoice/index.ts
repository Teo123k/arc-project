/**
 * Invoice Intelligence Layer
 * 
 * Centralized invoice matching, normalization, and intelligence.
 * NO OpenAI usage, NO pricing estimation, NO UI rendering.
 */

// Unit normalization & conversion
export {
  normalizeUnit,
  convertUnit,
  areUnitsCompatible,
  toCanonicalQuantity,
  type CanonicalUnit,
  type NormalizedUnit,
} from "./units";

// Ingredient name normalization
export {
  normalizeIngredientName,
  compareIngredientNames,
  ingredientContains,
  type NormalizedIngredient,
} from "./normalize";

// Alias dictionary
export {
  getCanonicalName,
  getAliases,
  areAliases,
  findAliasMatch,
} from "./aliases";

// Invoice line matching
export {
  matchInvoiceLine,
  matchAllIngredients,
  type MatchConfidence,
  type MatchResult,
  type InvoiceLineItem,
  type InvoiceData,
} from "./matchInvoiceLine";

// Historical price learning (silent capture)
export {
  captureHistoricalPrice,
  loadHistoricalPrices,
  findHistoricalPrices,
  getAverageHistoricalPrice,
  clearHistoricalPrices,
  type CaptureParams,
} from "./historicalPrices";

