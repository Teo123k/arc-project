export type CostMathIngredientLike = {
  priceUnknown?: boolean;
  unitPrice: number;
  total?: number;
};

export function splitIngredientsByPricing<T extends CostMathIngredientLike>(ingredients: T[]) {
  const pricedIngredients = ingredients.filter((i) => !i.priceUnknown && i.unitPrice > 0);
  const unknownPriceIngredients = ingredients.filter(
    // Keep semantics identical to the original CostOperations.tsx (global isNaN coercion).
    (i) => i.priceUnknown || i.unitPrice <= 0 || isNaN(i.unitPrice as any)
  );
  return { pricedIngredients, unknownPriceIngredients };
}

export function calculateDisplayedSubtotal<T extends CostMathIngredientLike>(pricedIngredients: T[]) {
  return pricedIngredients.reduce((sum, i) => sum + (i.total || 0), 0);
}

export function calculateMarkup(subtotal: number, markupPercent: number) {
  return subtotal * (markupPercent / 100);
}

export function calculateTotal(subtotal: number, markup: number, staffCost: number, transportCost: number) {
  return subtotal + markup + staffCost + transportCost;
}

export function calculateSubtotalFromTotals<T extends { total: number }>(ingredients: T[]) {
  return ingredients.reduce((sum, i) => sum + i.total, 0);
}

export function calculateCostPerGuestRounded(total: number, guestCount: number) {
  return guestCount > 0 ? Math.round(total / guestCount) : null;
}


