import {
  parseFinancialSection,
  inferGuestCount,
  calculateCostPerServing,
  calculateGrossMargin,
  calculateBreakEvenPrice,
} from "./financialMath";

export type DecisionVerdict = "GO" | "ADJUST" | "DO_NOT_PROCEED" | "UNKNOWN";

export type CanvasDecisionSections = {
  verdict?: string;
  financials?: string;
  operations?: string;
  risksAndGaps?: string;
  nextActions?: string;
};

export type SynthesizedDecision = {
  summary: {
    title: string;
  };
  decisionText: string;
  verdict: DecisionVerdict;
  financials?: {
    totalCost: number | null;
    expectedRevenue: number | null;
    margin: number | null;
    costPerServing: number | null;
    breakEvenPrice: number | null;
  };
  sections?: CanvasDecisionSections;
};

function parseDecisionSections(text: string): CanvasDecisionSections {
  const section = (label: string) => {
    const regex = new RegExp(
      `${label}:([\\s\\S]*?)(?=\\n[A-Z][A-Za-z &]+:|$)`,
      "i"
    );
    const match = text.match(regex);
    // Ensure match exists and capture group (match[1]) exists before calling trim()
    return match && match[1] ? match[1].trim() : undefined;
  };

  return {
    verdict: section("Verdict"),
    financials: section("Financials"),
    operations: section("Effort & Operations|Operations"),
    risksAndGaps: section("Risks|Risks & Gaps"),
    nextActions: section("Suggested Adjustments|Next Actions"),
  };
}

export function synthesizeDecision({
  arcReply,
}: {
  arcReply: string;
}): SynthesizedDecision | null {
  if (!arcReply) return null;

  // Extract DECISION_REVIEW block
  const reviewMatch = arcReply.match(/DECISION_REVIEW:([\s\S]*?)(?=\n\n[A-Z]|$)/i);
  const decisionText = reviewMatch && reviewMatch[1] ? reviewMatch[1].trim() : arcReply.trim();

  // Detect verdict - normalize to uppercase for matching
  const upperText = arcReply.toUpperCase();
  let verdict: DecisionVerdict = "UNKNOWN";

  // Only try to detect verdict if DECISION_REVIEW block was found
  if (reviewMatch) {
    // Matching rules (order matters):
    // 1. DO NOT PROCEED (highest priority)
    if (upperText.includes("DO NOT PROCEED") || upperText.includes("DO_NOT_PROCEED")) {
      verdict = "DO_NOT_PROCEED";
    }
    // 2. ADJUST (check for VERDICT + ADJUST pattern)
    else if (upperText.includes("VERDICT") && upperText.includes("ADJUST")) {
      verdict = "ADJUST";
    }
    // 3. GO or PROCEED (check for VERDICT + GO/PROCEED pattern)
    else if (upperText.includes("VERDICT") && (upperText.includes("GO") || upperText.includes("PROCEED"))) {
      verdict = "GO";
    }
  }

  // Extract and calculate financials
  // IMPORTANT: Only use numbers explicitly present in DECISION_REVIEW
  // Do NOT infer costs from prep, ingredients, or assumptions
  // Do NOT fabricate margins
  const { totalCost, expectedRevenue, margin: extractedMargin } = parseFinancialSection(decisionText);
  const guestCount = inferGuestCount(decisionText);

  let costPerServing: number | null = null;
  let breakEvenPrice: number | null = null;
  let calculatedMargin: number | null = null;

  // Only calculate derived values if source data is explicitly present
  if (totalCost !== null && guestCount !== null) {
    costPerServing = calculateCostPerServing(totalCost, guestCount);
    breakEvenPrice = calculateBreakEvenPrice(totalCost, guestCount);
  }

  // Only calculate margin if both revenue and cost are explicitly present
  if (expectedRevenue !== null && totalCost !== null) {
    calculatedMargin = calculateGrossMargin(expectedRevenue, totalCost);
  }

  const financials = {
    totalCost,
    expectedRevenue,
    margin: extractedMargin ?? calculatedMargin,
    costPerServing,
    breakEvenPrice,
  };

  const sections = parseDecisionSections(decisionText);

  return {
    summary: {
      title: `Decision Review: ${verdict}`,
    },
    decisionText,
    verdict,
    // Only include financials if at least one value was explicitly found
    financials: totalCost !== null || expectedRevenue !== null ? financials : undefined,
    sections,
  };
}

