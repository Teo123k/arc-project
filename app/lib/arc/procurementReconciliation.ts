type RecipeIngredient = {
  ingredient: string;
  quantity: number;
  unit?: string;
};

type InvoiceLineItem = {
  ingredient: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
};

type NormalizedAttributes = {
  protein?: string;
  cut?: string;
  processing?: string[];
  unit?: string;
};

type FinancialLine = {
  recipeIngredient: string;
  recipeQty: number;
  recipeUnit?: string;
  invoiceMatch: InvoiceLineItem | null;
  purchasedQty?: number;
  unitPrice?: number;
  price?: number;
  totalPrice?: number;
  confidence: number;
  status: "matched" | "ambiguous" | "missing";
  flags: string[];
};

export type ProcurementReconciliationResult = {
  financialLines: FinancialLine[];
  ambiguousIngredients: string[];
  missingIngredients: string[];
  extraInvoiceItems: string[];
};

function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "");
}

function extractNormalizedAttributes(ingredientName: string): NormalizedAttributes {
  const normalized = normalizeIngredientName(ingredientName);
  const attrs: NormalizedAttributes = {
    processing: [],
  };

  const proteins = ["chicken", "beef", "pork", "lamb", "turkey", "duck", "fish", "salmon", "tuna", "shrimp", "prawn"];
  const cuts = ["breast", "thigh", "leg", "wing", "drumstick", "fillet", "steak", "chop", "roast", "ground", "mince"];
  const processingTerms = ["boneless", "skinless", "bone-in", "skin-on", "frozen", "fresh", "organic", "free-range"];

  for (const protein of proteins) {
    if (normalized.includes(protein)) {
      attrs.protein = protein;
      break;
    }
  }

  for (const cut of cuts) {
    if (normalized.includes(cut)) {
      attrs.cut = cut;
      break;
    }
  }

  for (const term of processingTerms) {
    if (normalized.includes(term)) {
      attrs.processing!.push(term);
    }
  }

  const unitMatch = normalized.match(/\b(lb|lbs|kg|g|oz|pound|pounds|kilogram|gram|ounce|ounces)\b/);
  if (unitMatch) {
    attrs.unit = unitMatch[1];
  }

  return attrs;
}

function computeAttributeSimilarity(
  recipeAttrs: NormalizedAttributes,
  invoiceAttrs: NormalizedAttributes
): number {
  let score = 0;
  let maxScore = 0;

  if (recipeAttrs.protein || invoiceAttrs.protein) {
    maxScore += 0.4;
    if (recipeAttrs.protein && invoiceAttrs.protein) {
      if (recipeAttrs.protein === invoiceAttrs.protein) {
        score += 0.4;
      } else {
        score += 0.1;
      }
    }
  }

  if (recipeAttrs.cut || invoiceAttrs.cut) {
    maxScore += 0.3;
    if (recipeAttrs.cut && invoiceAttrs.cut) {
      if (recipeAttrs.cut === invoiceAttrs.cut) {
        score += 0.3;
      } else {
        score += 0.05;
      }
    }
  }

  if (recipeAttrs.processing || invoiceAttrs.processing) {
    maxScore += 0.2;
    if (recipeAttrs.processing && invoiceAttrs.processing) {
      const recipeSet = new Set(recipeAttrs.processing);
      const invoiceSet = new Set(invoiceAttrs.processing);
      const intersection = [...recipeSet].filter(x => invoiceSet.has(x)).length;
      const union = new Set([...recipeSet, ...invoiceSet]).size;
      if (union > 0) {
        score += (intersection / union) * 0.2;
      }
    }
  }

  if (recipeAttrs.unit || invoiceAttrs.unit) {
    maxScore += 0.1;
    if (recipeAttrs.unit && invoiceAttrs.unit) {
      if (recipeAttrs.unit === invoiceAttrs.unit) {
        score += 0.1;
      } else {
        const unitGroups: Record<string, string[]> = {
          "lb": ["lbs", "pound", "pounds"],
          "kg": ["kilogram"],
          "g": ["gram"],
          "oz": ["ounce", "ounces"],
        };
        const recipeGroup = Object.keys(unitGroups).find(k => k === recipeAttrs.unit || unitGroups[k]?.includes(recipeAttrs.unit!));
        const invoiceGroup = Object.keys(unitGroups).find(k => k === invoiceAttrs.unit || unitGroups[k]?.includes(invoiceAttrs.unit!));
        if (recipeGroup === invoiceGroup) {
          score += 0.05;
        }
      }
    }
  }

  return maxScore > 0 ? score / maxScore : 0;
}

function parseRecipeIngredients(text: string): RecipeIngredient[] {
  const items: RecipeIngredient[] = [];
  if (!text) return items;

  const patterns = [
    /(\d+\.?\d*)\s*(\w+)?\s+(.+?)(?:,|$|\n)/gi,
    /(.+?)\s*[-–—]\s*(\d+\.?\d*)\s*(\w+)?/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match.length >= 3) {
        const quantity = parseFloat(match[1]);
        const unit = match[2]?.trim();
        const ingredient = match[3]?.trim();

        if (ingredient && !isNaN(quantity) && quantity > 0) {
          items.push({
            ingredient,
            quantity,
            unit,
          });
        }
      }
    }
  }

  return items;
}

function parseInvoiceLineItems(text: string): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = [];
  if (!text) return items;

  const patterns = [
    /(.+?)\s+\$?(\d+\.?\d{2})/gi,
    /(.+?)\s*[-–—]\s*\$?(\d+\.?\d{2})/gi,
    /(.+?)\s+(\d+\.?\d*)\s*@\s*\$?(\d+\.?\d{2})/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match.length >= 3) {
        const ingredient = match[1]?.trim();
        const price1 = parseFloat(match[2]);
        const price2 = match[3] ? parseFloat(match[3]) : undefined;

        if (ingredient) {
          if (!isNaN(price1) && !isNaN(price2 || 0)) {
            items.push({
              ingredient,
              quantity: price1,
              unitPrice: price2,
              totalPrice: price1 * (price2 || 0),
            });
          } else if (!isNaN(price1)) {
            items.push({
              ingredient,
              totalPrice: price1,
            });
          }
        }
      }
    }
  }

  return items;
}

export function reconcileProcurement({
  recipeFiles,
  invoiceFiles,
}: {
  recipeFiles: Array<{ extractedText: string | null }>;
  invoiceFiles: Array<{ extractedText: string | null }>;
}): ProcurementReconciliationResult {
  const recipeIngredients: RecipeIngredient[] = [];
  const invoiceItems: InvoiceLineItem[] = [];

  for (const file of recipeFiles) {
    if (file.extractedText) {
      recipeIngredients.push(...parseRecipeIngredients(file.extractedText));
    }
  }

  for (const file of invoiceFiles) {
    if (file.extractedText) {
      invoiceItems.push(...parseInvoiceLineItems(file.extractedText));
    }
  }

  const financialLines: FinancialLine[] = [];
  const ambiguousIngredients: string[] = [];
  const missingIngredients: string[] = [];
  const matchedInvoiceIndices = new Set<number>();

  for (const recipeIng of recipeIngredients) {
    const recipeAttrs = extractNormalizedAttributes(recipeIng.ingredient);
    let bestMatch: { item: InvoiceLineItem; confidence: number; index: number } | null = null;

    for (let i = 0; i < invoiceItems.length; i++) {
      if (matchedInvoiceIndices.has(i)) continue;

      const invoiceAttrs = extractNormalizedAttributes(invoiceItems[i].ingredient);
      const confidence = computeAttributeSimilarity(recipeAttrs, invoiceAttrs);

      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { item: invoiceItems[i], confidence, index: i };
      }
    }

    let status: "matched" | "ambiguous" | "missing";
    const flags: string[] = [];

    if (!bestMatch || bestMatch.confidence < 0.70) {
      status = "missing";
      missingIngredients.push(recipeIng.ingredient);
      financialLines.push({
        recipeIngredient: recipeIng.ingredient,
        recipeQty: recipeIng.quantity,
        recipeUnit: recipeIng.unit,
        invoiceMatch: null,
        confidence: bestMatch?.confidence || 0,
        status,
        flags,
      });
    } else if (bestMatch.confidence >= 0.90) {
      status = "matched";
      matchedInvoiceIndices.add(bestMatch.index);
      const invoice = bestMatch.item;
      financialLines.push({
        recipeIngredient: recipeIng.ingredient,
        recipeQty: recipeIng.quantity,
        recipeUnit: recipeIng.unit,
        invoiceMatch: invoice,
        purchasedQty: invoice.quantity,
        unitPrice: invoice.unitPrice,
        price: invoice.totalPrice,
        totalPrice: invoice.totalPrice || (invoice.unitPrice && recipeIng.quantity ? invoice.unitPrice * recipeIng.quantity : undefined),
        confidence: bestMatch.confidence,
        status,
        flags,
      });
    } else {
      status = "ambiguous";
      ambiguousIngredients.push(recipeIng.ingredient);
      matchedInvoiceIndices.add(bestMatch.index);
      const invoice = bestMatch.item;
      flags.push("low-confidence-match");
      financialLines.push({
        recipeIngredient: recipeIng.ingredient,
        recipeQty: recipeIng.quantity,
        recipeUnit: recipeIng.unit,
        invoiceMatch: invoice,
        purchasedQty: invoice.quantity,
        unitPrice: invoice.unitPrice,
        price: invoice.totalPrice,
        totalPrice: invoice.totalPrice || (invoice.unitPrice && recipeIng.quantity ? invoice.unitPrice * recipeIng.quantity : undefined),
        confidence: bestMatch.confidence,
        status,
        flags,
      });
    }
  }

  const extraInvoiceItems: string[] = [];
  for (let i = 0; i < invoiceItems.length; i++) {
    if (!matchedInvoiceIndices.has(i)) {
      extraInvoiceItems.push(invoiceItems[i].ingredient);
    }
  }

  return {
    financialLines,
    ambiguousIngredients,
    missingIngredients,
    extraInvoiceItems,
  };
}










