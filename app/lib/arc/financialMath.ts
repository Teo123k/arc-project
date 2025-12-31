export type FinancialData = {
  totalCost: number | null;
  expectedRevenue: number | null;
  margin: number | null;
  costPerServing: number | null;
  breakEvenPrice: number | null;
};

/**
 * Extract numeric values from Financials section in decision text
 */
export function parseFinancialSection(decisionText: string): {
  totalCost: number | null;
  expectedRevenue: number | null;
  margin: number | null;
} {
  const result = {
    totalCost: null as number | null,
    expectedRevenue: null as number | null,
    margin: null as number | null,
  };

  try {
    // Extract Total cost
    const costMatch = decisionText.match(/Total cost:\s*\$?([\d,]+\.?\d*)/i);
    if (costMatch) {
      const parsed = parseFloat(costMatch[1].replace(/,/g, ""));
      if (!isNaN(parsed)) result.totalCost = parsed;
    }

    // Extract Expected revenue
    const revenueMatch = decisionText.match(/Expected revenue:\s*\$?([\d,]+\.?\d*)/i);
    if (revenueMatch) {
      const parsed = parseFloat(revenueMatch[1].replace(/,/g, ""));
      if (!isNaN(parsed)) result.expectedRevenue = parsed;
    }

    // Extract Margin
    const marginMatch = decisionText.match(/Margin:\s*\$?([\d,]+\.?\d*)/i);
    if (marginMatch) {
      const parsed = parseFloat(marginMatch[1].replace(/,/g, ""));
      if (!isNaN(parsed)) result.margin = parsed;
    }
  } catch {
    // Silently return null values on any error
  }

  return result;
}

/**
 * Infer guest count from decision text using common patterns
 */
export function inferGuestCount(decisionText: string): number | null {
  try {
    // Match patterns: "40 guests", "serves 40", "for 40 people", "50 attendees"
    const patterns = [
      /(\d+)\s+guests?/i,
      /serves?\s+(\d+)/i,
      /for\s+(\d+)\s+people/i,
      /(\d+)\s+people/i,
      /(\d+)\s+attendees?/i,
    ];

    for (const pattern of patterns) {
      const match = decisionText.match(pattern);
      if (match) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
  } catch {
    // Silently return null on any error
  }

  return null;
}

/**
 * Calculate cost per serving
 */
export function calculateCostPerServing(totalCost: number, guests: number): number {
  if (guests <= 0 || totalCost < 0) return 0;
  return Math.round((totalCost / guests) * 100) / 100;
}

/**
 * Calculate gross margin percentage
 */
export function calculateGrossMargin(revenue: number, cost: number): number {
  if (revenue <= 0 || cost < 0) return 0;
  const margin = ((revenue - cost) / revenue) * 100;
  return Math.round(margin * 100) / 100;
}

/**
 * Calculate break-even price per serving
 */
export function calculateBreakEvenPrice(cost: number, guests: number): number {
  if (guests <= 0 || cost < 0) return 0;
  return Math.round((cost / guests) * 100) / 100;
}










