"use client";

import { useEffect, useMemo, useState } from "react";
import { ShoppingListItem, CostItemAudit, MatchConfidence } from "@/app/lib/core/shared/types";
import {
  calculateCostPerGuestRounded,
  calculateDisplayedSubtotal,
  calculateMarkup,
  calculateSubtotalFromTotals,
  calculateTotal,
  splitIngredientsByPricing,
} from "@/app/lib/core/pricing/costMath";
import {
  matchInvoiceLine,
  captureHistoricalPrice,
  type InvoiceData,
} from "@/app/lib/core/invoice";
import { ChefTimeline, type OperationStep } from "./ChefTimeline";

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

type EventCostItem = {
  ingredientName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  source: "invoice" | "historical-invoice" | "manual" | "unknown";
  total: number;
  verified: boolean;
  // Flag for ingredients without pricing data
  priceUnknown?: boolean;
  // Flag for cost items no longer in shopping list (preserved for manual prices)
  orphaned?: boolean;
  // Audit trail for traceability (DIFF 7)
  audit?: CostItemAudit;
};

type EventCostBreakdown = {
  ingredients: EventCostItem[];
  subtotal: number;
  markupPercent?: number;
  markup?: number;
  staffCost?: number;
  transportCost?: number;
  otherCosts?: number;
  total: number;
};

type EventOperationsTimeline = {
  entries: Array<{
    day: string;
    time?: string;
    task: string;
  }>;
};

type InvoiceItem = {
  name: string;
  unitPrice?: string;
  unit?: string;
};

type Invoice = {
  id: string;
  vendor?: string;
  items?: InvoiceItem[];
};

type RecipeIngredient = {
  name: string;
  quantity: number | null;
  unit: string | null;
  preparation?: string;
  category?: "fresh" | "dry" | "other";
};

type Recipe = {
  id: string;
  name: string;
  prepTime?: number;
  course?: string;
  servings?: number;
  ingredients?: RecipeIngredient[];
};

// ShoppingListItem imported from @/app/lib/core/shared/types

interface CostOperationsProps {
  costBreakdown: EventCostBreakdown | null;
  operations: EventOperationsTimeline | null;
  currency: string;
  guestCount: number;
  invoices: Invoice[];
  onUpdateCost: (cost: EventCostBreakdown) => void;
  onUpdateOperations: (ops: EventOperationsTimeline) => void;
  // For AI timeline generation
  recipes?: Recipe[];
  eventName?: string;
  eventDate?: string;
  serviceStart?: string;
  serviceEnd?: string;
  eventLocation?: string;
  eventOccasion?: string;
  menuStyle?: string;
  kitchen?: {
    onSitePrep?: boolean;
    externalKitchen?: boolean;
    transportRequired?: boolean;
  };
  // Shopping list (derived from menu, single source of truth for ingredients)
  shoppingList?: ShoppingListItem[];
}

// ────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ────────────────────────────────────────────────────────────────────────────

export function CostOperations({
  costBreakdown,
  operations,
  currency,
  guestCount,
  invoices,
  onUpdateCost,
  onUpdateOperations,
  recipes = [],
  eventName,
  eventDate,
  serviceStart,
  serviceEnd,
  eventLocation,
  eventOccasion,
  menuStyle,
  kitchen,
  shoppingList = [],
}: CostOperationsProps) {
  const [activeTab, setActiveTab] = useState<"cost" | "shopping" | "operations">("cost");
  const [markupPercent, setMarkupPercent] = useState(costBreakdown?.markupPercent || 30);
  const [staffCost, setStaffCost] = useState(costBreakdown?.staffCost || 0);
  const [transportCost, setTransportCost] = useState(costBreakdown?.transportCost || 0);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  // DIFF 2: Cost Snapshot is default, ingredient list is drill-down
  const [showIngredientDetail, setShowIngredientDetail] = useState(false);
  // DIFF 3: Pagination for ingredient list
  const [ingredientPage, setIngredientPage] = useState(0);
  const INGREDIENTS_PER_PAGE = 8;
  // DIFF 5: Lock quantities after invoice match
  const [quantitiesLocked, setQuantitiesLocked] = useState(false);
  // Task 7: Category-based paging
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  // Share timeline state
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  // Note: No AI/market price estimation - prices come ONLY from invoices

  // Initialize cost breakdown if empty
  const ingredients = costBreakdown?.ingredients || [];

  // Calculate totals (exclude items with unknown prices)
  // Separate active (non-orphaned) from orphaned items
  const activeIngredients = ingredients.filter((i) => !i.orphaned);
  const orphanedIngredients = ingredients.filter((i) => i.orphaned);

  // Calculate totals ONLY from non-orphaned items
  const { pricedIngredients, unknownPriceIngredients } = splitIngredientsByPricing(activeIngredients);
  const subtotal = calculateDisplayedSubtotal(pricedIngredients);
  const markup = calculateMarkup(subtotal, markupPercent);
  const total = calculateTotal(subtotal, markup, staffCost, transportCost);
  
  // Pricing is complete only when ALL active items have prices
  const allActiveItemsPriced = activeIngredients.length > 0 && unknownPriceIngredients.length === 0;

  // ─────────────────────────────────────────────────────────────────────────
  // COST SNAPSHOT STATS (DIFF 2)
  // ─────────────────────────────────────────────────────────────────────────
  const totalIngredientCount = activeIngredients.length;
  const invoiceMatchedCount = activeIngredients.filter(
    (i) => i.source === "invoice" || i.source === "historical-invoice"
  ).length;
  const unmatchedCount = activeIngredients.filter(
    (i) => i.source === "unknown" || i.priceUnknown
  ).length;
  const hasAnyInvoiceMatch = invoiceMatchedCount > 0;
  
  // DIFF 5: Auto-lock quantities when any invoice is matched
  const shouldLockQuantities = hasAnyInvoiceMatch || quantitiesLocked;

  // Pagination (DIFF 3)
  const totalPages = Math.ceil(activeIngredients.length / INGREDIENTS_PER_PAGE);
  const paginatedIngredients = activeIngredients.slice(
    ingredientPage * INGREDIENTS_PER_PAGE,
    (ingredientPage + 1) * INGREDIENTS_PER_PAGE
  );

  // ─────────────────────────────────────────────────────────────────────────
  // INVOICE MATCHING (using centralized invoice intelligence layer)
  // ─────────────────────────────────────────────────────────────────────────
  
  // Convert invoices to InvoiceData format for the matcher
  const invoiceData: InvoiceData[] = useMemo(() => {
    return invoices.map((inv) => ({
      id: inv.id,
      vendor: inv.vendor,
      date: inv.uploadedAt ? new Date(inv.uploadedAt).toISOString() : undefined,
      items: (inv.items || []).map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: typeof item.unitPrice === "string" 
          ? parseFloat(item.unitPrice) 
          : (item.unitPrice || 0),
        totalPrice: item.total,
      })),
    }));
  }, [invoices]);

  // Find price from invoices using intelligent matching
  const findPriceFromInvoice = (
    ingredientName: string,
    ingredientUnit: string = "each"
  ): { 
    price: number; 
    source: string; 
    confidence: MatchConfidence;
    invoiceId?: string;
    unitConverted?: boolean;
    aliasUsed?: boolean;
  } | null => {
    const match = matchInvoiceLine(ingredientName, ingredientUnit, invoiceData);
    
    if (!match.matched || match.confidence === "none" || !match.unitPrice) {
      return null;
    }

    return {
      price: match.unitPrice,
      source: match.invoiceVendor || "Invoice",
      confidence: match.confidence,
      invoiceId: match.invoiceId || undefined,
      unitConverted: match.matchDetails.unitConverted,
      aliasUsed: match.matchDetails.aliasUsed,
    };
  };

  // Update an ingredient
  const updateIngredient = (index: number, updates: Partial<EventCostItem>) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], ...updates };
    if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
      updated[index].total = updated[index].quantity * updated[index].unitPrice;
    }
    saveCostBreakdown(updated);
  };

  // Add ingredient
  const addIngredient = () => {
    const newItem: EventCostItem = {
      ingredientName: "",
      quantity: 0,
      unit: "kg",
      unitPrice: 0,
      source: "manual",
      total: 0,
      verified: false,
    };
    saveCostBreakdown([...ingredients, newItem]);
  };

  // Remove ingredient
  const removeIngredient = (index: number) => {
    saveCostBreakdown(ingredients.filter((_, i) => i !== index));
  };

  // Save cost breakdown
  const saveCostBreakdown = (updatedIngredients: EventCostItem[]) => {
    const newSubtotal = calculateSubtotalFromTotals(updatedIngredients);
    const newMarkup = calculateMarkup(newSubtotal, markupPercent);
    onUpdateCost({
      ingredients: updatedIngredients,
      subtotal: newSubtotal,
      markupPercent,
      markup: newMarkup,
      staffCost,
      transportCost,
      total: calculateTotal(newSubtotal, newMarkup, staffCost, transportCost),
    });
  };

  // Update other costs
  const updateOtherCosts = () => {
    onUpdateCost({
      ingredients,
      subtotal,
      markupPercent,
      markup,
      staffCost,
      transportCost,
      total: calculateTotal(subtotal, markup, staffCost, transportCost),
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SYNC COST ROWS FROM SHOPPING LIST (MERGE, NOT REPLACE)
  // ─────────────────────────────────────────────────────────────────────────
  // Shopping list is derived from Menu and passed as prop.
  // This MERGES with existing cost rows to preserve manual price edits.

  // Generate stable key for matching: normalize(ingredientName)::unit
  const costItemKey = (name: string, unit: string) => 
    `${name.toLowerCase().trim()}::${unit.toLowerCase()}`;

  const syncCostFromShoppingList = () => {
    // Build a map of existing cost items by key (to preserve manual edits)
    const existingByKey = new Map<string, EventCostItem>();
    ingredients.forEach((item) => {
      const key = costItemKey(item.ingredientName, item.unit);
      existingByKey.set(key, item);
    });

    // Track which keys are still in the shopping list
    const shoppingListKeys = new Set<string>();

    // Merge shopping list items with existing cost rows
    const mergedItems: EventCostItem[] = shoppingList.map((item) => {
      const key = costItemKey(item.ingredientName, item.unit);
      shoppingListKeys.add(key);
      
      const existing = existingByKey.get(key);
      
      if (existing) {
        // EXISTING: Preserve price data, update quantity only
        const newTotal = existing.unitPrice > 0 
          ? Math.round(item.quantity * existing.unitPrice * 100) / 100 
          : 0;
        
        return {
          ...existing,
          ingredientName: item.ingredientName, // Update display name
          quantity: item.quantity,             // Update quantity from menu
          unit: item.unit,                     // Keep unit
          total: newTotal,                     // Recalculate total
          orphaned: false,                     // Clear orphaned flag
        };
      } else {
        // NEW: Attempt invoice match with unit-aware matching
        const invoiceMatch = findPriceFromInvoice(item.ingredientName, item.unit);
        
        // Build audit trail
        const audit: CostItemAudit | undefined = invoiceMatch ? {
          source: "invoice",
          confidence: invoiceMatch.confidence,
          invoiceId: invoiceMatch.invoiceId,
          invoiceVendor: invoiceMatch.source,
          timestamp: new Date().toISOString(),
          unitConverted: invoiceMatch.unitConverted,
          aliasUsed: invoiceMatch.aliasUsed,
        } : undefined;

        // Capture for historical learning (silent, non-blocking)
        if (invoiceMatch && invoiceMatch.confidence !== "none") {
          captureHistoricalPrice({
            ingredientName: item.ingredientName,
            unit: item.unit,
            unitPrice: invoiceMatch.price,
            quantity: item.quantity,
            currency,
            invoiceId: invoiceMatch.invoiceId || "",
            invoiceVendor: invoiceMatch.source,
            confidence: invoiceMatch.confidence,
          });
        }
        
        return {
          ingredientName: item.ingredientName,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: invoiceMatch?.price || 0,
          source: invoiceMatch ? "invoice" as const : "unknown" as const,
          total: invoiceMatch ? Math.round(item.quantity * invoiceMatch.price * 100) / 100 : 0,
          verified: !!invoiceMatch,
          priceUnknown: !invoiceMatch,
          orphaned: false,
          audit,
        };
      }
    });

    // Handle orphaned items: cost rows NOT in shopping list but have manual/invoice prices
    ingredients.forEach((item) => {
      const key = costItemKey(item.ingredientName, item.unit);
      if (!shoppingListKeys.has(key)) {
        // Only keep if it has a valid price (manual or invoice)
        if (item.source === "manual" || item.source === "invoice" || item.source === "historical-invoice") {
          mergedItems.push({
            ...item,
            orphaned: true, // Mark as orphaned
          });
        }
        // Unknown-priced orphans are discarded (no value to keep)
      }
    });

    // Sort for stable output
    mergedItems.sort((a, b) => 
      costItemKey(a.ingredientName, a.unit).localeCompare(costItemKey(b.ingredientName, b.unit))
    );

    // Only update if different from current (compare identity + quantity + orphaned)
    const toCompare = (list: EventCostItem[]) => 
      list.map((i) => ({ 
        k: costItemKey(i.ingredientName, i.unit), 
        q: i.quantity, 
        p: i.unitPrice,
        o: i.orphaned || false,
      }));
    
    const currentStr = JSON.stringify(toCompare(ingredients));
    const newStr = JSON.stringify(toCompare(mergedItems));
    
    if (currentStr !== newStr) {
      saveCostBreakdown(mergedItems);
    }
  };

  // Auto-sync cost rows when shopping list or invoices change
  useEffect(() => {
    syncCostFromShoppingList();
  }, [shoppingList, invoices]);

  // Check if there are ingredients needing prices
  const hasUnpricedIngredients = unknownPriceIngredients.length > 0;

  // Operations timeline
  const timelineEntries = operations?.entries || [];

  const addTimelineEntry = () => {
    onUpdateOperations({
      entries: [...timelineEntries, { day: "D-0", time: "", task: "" }],
    });
  };

  const updateTimelineEntry = (index: number, updates: Partial<typeof timelineEntries[0]>) => {
    const updated = [...timelineEntries];
    updated[index] = { ...updated[index], ...updates };
    onUpdateOperations({ entries: updated });
  };

  const removeTimelineEntry = (index: number) => {
    onUpdateOperations({ entries: timelineEntries.filter((_, i) => i !== index) });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // MARGIN CALCULATOR REMOVED
  // Margin calculations are now purely invoice-backed
  // No target percentages or AI opinions on cost health

  // ─────────────────────────────────────────────────────────────────────────
  // AI TIMELINE GENERATION
  // ─────────────────────────────────────────────────────────────────────────

  const generateAITimeline = async () => {
    if (recipes.length === 0) return;
    
    setLoadingTimeline(true);
    try {
      const res = await fetch("/api/arc/generate-operations-timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipes: recipes.map((r) => ({
            name: r.name,
            prepTime: r.prepTime,
            course: r.course,
          })),
          guestCount,
          eventDate,
          serviceStart,
          serviceEnd,
          location: eventLocation,
          kitchen,
          menuStyle,
          occasion: eventOccasion,
        }),
      });
      
      const data = await res.json();
      
      if (data.timeline && Array.isArray(data.timeline)) {
        onUpdateOperations({
          entries: data.timeline.map((t: { day: string; time?: string; task: string }) => ({
            day: t.day,
            time: t.time || "",
            task: t.task,
          })),
        });
      }
    } catch (err) {
      console.error("Failed to generate timeline:", err);
    } finally {
      setLoadingTimeline(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SHARE TIMELINE
  // ─────────────────────────────────────────────────────────────────────────

  const shareTimeline = async () => {
    if (timelineEntries.length === 0) return;
    
    setSharing(true);
    try {
      const res = await fetch("/api/arc/share-timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventName: eventName || "Event",
          eventDate,
          serviceStart,
          serviceEnd,
          guestCount,
          operations: timelineEntries.map((entry, idx) => ({
            id: `op-${idx}`,
            time: entry.time || entry.day,
            task: entry.task,
            duration: "—",
            category: entry.day.includes("D-0") ? "service" : "prep",
          })),
          chefs: [], // Will be populated by ChefTimeline
          taskAssignments: {},
        }),
      });
      
      if (!res.ok) {
        throw new Error("Failed to share timeline");
      }
      
      const data = await res.json();
      setShareUrl(data.shareUrl);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(data.shareUrl);
      
    } catch (err) {
      console.error("Failed to share timeline:", err);
    } finally {
      setSharing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SHOPPING LIST - Group ingredients by category
  // ─────────────────────────────────────────────────────────────────────────

  const ingredientsByCategory = useMemo(() => {
    const categories: Record<string, EventCostItem[]> = {
      "Proteins": [],
      "Produce": [],
      "Dairy & Eggs": [],
      "Dry Goods": [],
      "Other": [],
    };
    
    ingredients.forEach((item) => {
      const name = item.ingredientName.toLowerCase();
      if (/fish|chicken|beef|pork|lamb|shrimp|prawns|crab|lobster|seafood|meat/.test(name)) {
        categories["Proteins"].push(item);
      } else if (/milk|cream|cheese|butter|yogurt|egg/.test(name)) {
        categories["Dairy & Eggs"].push(item);
      } else if (/flour|rice|pasta|sugar|salt|oil|vinegar|spice|herb|garlic|onion/.test(name)) {
        categories["Dry Goods"].push(item);
      } else if (/vegetable|tomato|carrot|potato|lettuce|spinach|pepper|cucumber|fruit|lemon|lime|orange|apple|banana/.test(name)) {
        categories["Produce"].push(item);
      } else {
        categories["Other"].push(item);
      }
    });
    
    return Object.entries(categories).filter(([, items]) => items.length > 0);
  }, [ingredients]);

  return (
    <div className="h-full flex flex-col bg-[#FAF8F4]">
      {/* Clean header */}
      <div className="px-6 py-5 border-b border-[#E0D4BF]">
        <h1 className="text-2xl font-semibold text-[#2F2A25]" style={{ fontFamily: "'Georgia', serif" }}>
          Procurement List
          <span className="text-sm font-normal text-[#8B7E6A] ml-2">(Invoice-backed)</span>
        </h1>
        <p className="text-sm text-[#8B7E6A] mt-1">
          {guestCount ? `${guestCount} guests` : "Guest count not set"} · Amounts scaled from recipes
        </p>
      </div>

      {/* Status banner - only when incomplete */}
      {unknownPriceIngredients.length > 0 && (
        <div className="px-6 py-3 bg-amber-50/80 border-b border-amber-100">
          <p className="text-sm text-amber-700">
            <span className="font-medium">{unknownPriceIngredients.length}</span> ingredient{unknownPriceIngredients.length > 1 ? "s" : ""} awaiting invoice price
            <span className="text-amber-600 ml-1">— upload invoices to complete</span>
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#E0D4BF] px-6">
        <button
          onClick={() => setActiveTab("cost")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
            activeTab === "cost"
              ? "border-[#2F2A25] text-[#2F2A25]"
              : "border-transparent text-[#8B7E6A] hover:text-[#4A331D]"
          }`}
        >
          Ingredients
        </button>
        <button
          onClick={() => setActiveTab("shopping")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
            activeTab === "shopping"
              ? "border-[#2F2A25] text-[#2F2A25]"
              : "border-transparent text-[#8B7E6A] hover:text-[#4A331D]"
          }`}
        >
          By Category
        </button>
        <button
          onClick={() => setActiveTab("operations")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
            activeTab === "operations"
              ? "border-[#2F2A25] text-[#2F2A25]"
              : "border-transparent text-[#8B7E6A] hover:text-[#4A331D]"
          }`}
        >
          Operations Timeline
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "cost" && (
          <div className="h-full flex flex-col">
            {/* ═══════════════════════════════════════════════════════════════
                PROCUREMENT STATUS — Primary view, one screen, no scroll
            ═══════════════════════════════════════════════════════════════ */}
            {!showIngredientDetail ? (
              <div className="flex-1 flex flex-col justify-center items-center px-8 py-12">
                {/* Large status display */}
                <div className="text-center mb-12">
                  <h2 className="text-3xl font-semibold text-[#2F2A25] mb-2" style={{ fontFamily: "'Georgia', serif" }}>
                    Procurement Status
                  </h2>
                  <p className="text-[#8B7E6A]">
                    {guestCount ? `${guestCount} guests` : "Event"} · {totalIngredientCount} ingredients (scaled from recipes)
                  </p>
                </div>

                {/* Stats grid - large typography */}
                <div className="grid grid-cols-3 gap-8 mb-12 w-full max-w-xl">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-[#2F2A25]" style={{ fontFamily: "'Georgia', serif" }}>
                      {totalIngredientCount}
                    </div>
                    <div className="text-sm text-[#8B7E6A] mt-1">Required amounts</div>
                    <div className="text-xs text-[#A89D8A]">Scaled from recipes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-green-600" style={{ fontFamily: "'Georgia', serif" }}>
                      {invoiceMatchedCount}
                    </div>
                    <div className="text-sm text-[#8B7E6A] mt-1 flex items-center justify-center gap-1">
                      <span className="text-green-500">✓</span> From uploaded invoice
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-amber-500" style={{ fontFamily: "'Georgia', serif" }}>
                      {unmatchedCount}
                    </div>
                    <div className="text-sm text-[#8B7E6A] mt-1 flex items-center justify-center gap-1">
                      <span className="text-amber-400">⧗</span> Awaiting invoice
                    </div>
                  </div>
                </div>

                {/* Invoice-backed cost message */}
                {unmatchedCount > 0 ? (
                  <div className="text-center max-w-md">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <span className="text-2xl">🔒</span>
                      <p className="text-lg text-amber-700">
                        Final food cost available after all invoices are uploaded.
                      </p>
                    </div>
                    <p className="text-sm text-[#A89D8A]">
                      {unmatchedCount} ingredient{unmatchedCount > 1 ? "s" : ""} awaiting invoice
                    </p>
                  </div>
                ) : allActiveItemsPriced && totalIngredientCount > 0 ? (
                  <div className="text-center">
                    <div className="text-5xl font-bold text-[#2F2A25] mb-2" style={{ fontFamily: "'Georgia', serif" }}>
                      {currency} {total.toLocaleString()}
                    </div>
                    <p className="text-sm text-green-600 flex items-center justify-center gap-1">
                      <span>✓</span> Invoice-backed cost
                    </p>
                    {guestCount > 0 && (
                      <p className="text-sm text-[#A89D8A] mt-1">
                        {currency} {Math.round(total / guestCount).toLocaleString()} per guest
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-[#A89D8A]">
                    <p>Add recipes to the menu to see ingredients here.</p>
                  </div>
                )}

                {/* Quantity lock status (DIFF 5) */}
                {shouldLockQuantities && (
                  <div className="mt-8 flex items-center gap-2 text-sm text-[#8B7E6A]">
                    <span className="text-blue-500">🔒</span>
                    <span>Quantities locked after invoice upload</span>
                    <button
                      onClick={() => setQuantitiesLocked(false)}
                      className="text-xs text-[#A89D8A] underline hover:text-[#6F6352] ml-2"
                    >
                      Unlock
                    </button>
                  </div>
                )}

                {/* Drill-down button */}
                {totalIngredientCount > 0 && (
                  <button
                    onClick={() => setShowIngredientDetail(true)}
                    className="mt-8 px-6 py-3 border border-[#E0D4BF] rounded-lg text-sm text-[#6F6352] hover:bg-[#FBF4E8] transition"
                  >
                    View ingredient details →
                  </button>
                )}
              </div>
            ) : (
              /* ═══════════════════════════════════════════════════════════════
                  INGREDIENT DETAIL (DIFF 3) — Secondary, paginated view
              ═══════════════════════════════════════════════════════════════ */
              <div className="flex-1 flex flex-col">
                {/* Header with back button */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setShowIngredientDetail(false)}
                    className="text-sm text-[#8B7E6A] hover:text-[#4A331D] flex items-center gap-1"
                  >
                    ← Back to summary
                  </button>
                  <div className="text-xs text-[#A89D8A]">
                    {activeIngredients.length} ingredients
                    {shouldLockQuantities && (
                      <span className="ml-2 text-blue-500">🔒 Locked</span>
                    )}
                  </div>
                </div>

                {/* Paginated ingredient list (DIFF 1 - no pricing columns) */}
                <div className="flex-1 space-y-2">
                  {paginatedIngredients.map((item, idx) => {
                    const globalIdx = ingredientPage * INGREDIENTS_PER_PAGE + idx;
                    const isInvoiceMatched = item.source === "invoice" || item.source === "historical-invoice";
                    const isAwaiting = item.source === "unknown" || item.priceUnknown;
                    
                    // Source badge (DIFF 6)
                    const getSourceBadge = () => {
                      if (isInvoiceMatched) {
                        return (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <span>✓</span> Invoice matched
                          </span>
                        );
                      }
                      if (isAwaiting) {
                        return (
                          <span className="text-xs text-amber-600 flex items-center gap-1">
                            <span>⧗</span> Awaiting invoice
                          </span>
                        );
                      }
                      return (
                        <span className="text-xs text-[#8B7E6A]">From menu</span>
                      );
                    };

                    return (
                      <div
                        key={globalIdx}
                        className="flex items-center gap-4 py-3 px-4 rounded-lg bg-[#FBF4E8]/50 hover:bg-[#FBF4E8]"
                      >
                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-[#2F2A25] truncate">
                            {item.ingredientName}
                          </div>
                        </div>

                        {/* Quantity + unit (with lock indicator) */}
                        <div className="text-sm text-[#6F6352] flex items-center gap-1">
                          {shouldLockQuantities && (
                            <span className="text-blue-400 text-xs">🔒</span>
                          )}
                          <span>{item.quantity} {item.unit}</span>
                        </div>

                        {/* Source badge (DIFF 6) */}
                        <div className="w-32 text-right">
                          {getSourceBadge()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination controls (DIFF 3) */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 pt-4 border-t border-[#E0D4BF] mt-4">
                    <button
                      onClick={() => setIngredientPage((p) => Math.max(0, p - 1))}
                      disabled={ingredientPage === 0}
                      className="px-3 py-1 text-sm text-[#6F6352] border border-[#E0D4BF] rounded hover:bg-[#FBF4E8] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ← Previous
                    </button>
                    <span className="text-sm text-[#8B7E6A]">
                      Page {ingredientPage + 1} of {totalPages}
                    </span>
                    <button
                      onClick={() => setIngredientPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={ingredientPage >= totalPages - 1}
                      className="px-3 py-1 text-sm text-[#6F6352] border border-[#E0D4BF] rounded hover:bg-[#FBF4E8] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next →
                    </button>
                  </div>
                )}

                {/* Add ingredient (only if not locked) */}
                {!shouldLockQuantities && (
                  <button
                    onClick={addIngredient}
                    className="mt-4 text-sm text-[#8B7E6A] hover:text-[#4A331D] transition"
                  >
                    + Add ingredient manually
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            SHOPPING LIST TAB — Category-based paging (one category per view)
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "shopping" && (
          <div className="h-full flex flex-col">
            {ingredients.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8">
                <p className="text-[#8B7E6A]">No ingredients yet</p>
                <p className="text-xs text-[#A89D8A] mt-1">
                  Add recipes to the menu to build your shopping list
                </p>
              </div>
            ) : (
              <>
                {/* Category navigation - horizontal paging */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setActiveCategoryIndex(Math.max(0, activeCategoryIndex - 1))}
                    disabled={activeCategoryIndex === 0}
                    className="px-3 py-2 text-sm text-[#6F6352] border border-[#E0D4BF] rounded-lg hover:bg-[#FBF4E8] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← Previous
                  </button>
                  <div className="text-center">
                    <div className="text-sm font-medium text-[#4A331D]">
                      {ingredientsByCategory[activeCategoryIndex]?.[0] || "No category"}
                    </div>
                    <div className="text-xs text-[#8B7E6A]">
                      {activeCategoryIndex + 1} of {ingredientsByCategory.length} categories
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveCategoryIndex(Math.min(ingredientsByCategory.length - 1, activeCategoryIndex + 1))}
                    disabled={activeCategoryIndex >= ingredientsByCategory.length - 1}
                    className="px-3 py-2 text-sm text-[#6F6352] border border-[#E0D4BF] rounded-lg hover:bg-[#FBF4E8] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>

                {/* Current category items */}
                {ingredientsByCategory[activeCategoryIndex] && (
                  <div className="flex-1">
                    {(() => {
                      const [, items] = ingredientsByCategory[activeCategoryIndex];
                      const unpricedInCat = items.filter(i => !i.unitPrice || i.unitPrice <= 0 || i.priceUnknown).length;
                      
                      return (
                        <>
                          {/* Category header */}
                          <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-[#E0D4BF]">
                            <span className="text-xs text-[#8B7E6A]">
                              {items.length} item{items.length > 1 ? "s" : ""}
                            </span>
                            {unpricedInCat > 0 && (
                              <span className="text-xs text-amber-600">
                                {unpricedInCat} awaiting invoice
                              </span>
                            )}
                          </div>

                          {/* Item list - text-forward, no scroll */}
                          <div className="space-y-2">
                            {items.map((item, idx) => {
                              const hasPrice = item.unitPrice && item.unitPrice > 0 && !item.priceUnknown;
                              const isInvoice = item.source === "invoice" || item.source === "historical-invoice";
                              const isManual = item.source === "manual";
                              
                              return (
                                <div 
                                  key={idx} 
                                  className="flex items-center py-2"
                                >
                                  {/* Name */}
                                  <span className="flex-1 text-[#2F2A25]">
                                    {item.ingredientName}
                                  </span>
                                  
                                  {/* Required amount */}
                                  <span className="text-sm text-[#8B7E6A] w-28 text-right">
                                    {item.quantity} {item.unit}
                                  </span>
                                  
                                  {/* Source label - explicit provenance */}
                                  <span className="w-40 text-right text-xs">
                                    {hasPrice ? (
                                      isInvoice ? (
                                        <span className="text-green-600">✓ From uploaded invoice</span>
                                      ) : isManual ? (
                                        <span className="text-blue-600">Manually confirmed</span>
                                      ) : (
                                        <span className="text-[#8B7E6A]">Scaled from recipes</span>
                                      )
                                    ) : (
                                      <span className="text-amber-600">⧗ Awaiting invoice</span>
                                    )}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Summary footer */}
                <div className="pt-4 mt-auto border-t border-[#E0D4BF]">
                  {hasUnpricedIngredients ? (
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <span>🔒</span>
                        <p className="text-sm text-amber-700">
                          Final food cost available after all invoices are uploaded.
                        </p>
                      </div>
                      <p className="text-xs text-[#8B7E6A]">
                        {unknownPriceIngredients.length} ingredient{unknownPriceIngredients.length > 1 ? "s" : ""} awaiting invoice
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm text-green-600 flex items-center gap-1">
                        <span>✓</span> Invoice-backed cost
                      </span>
                      <span className="text-lg font-semibold text-[#2F2A25]">
                        {currency} {subtotal.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "operations" && (
          <div className="h-full flex flex-col">
            {/* Generate button */}
            {recipes.length > 0 && timelineEntries.length === 0 && (
              <div className="mb-4 flex justify-end">
                <button
                  onClick={generateAITimeline}
                  disabled={loadingTimeline}
                  className="px-4 py-2 bg-[#4A331D] text-white text-xs rounded-lg hover:bg-[#2F2A25] transition flex items-center gap-2 disabled:opacity-50"
                >
                  {loadingTimeline ? (
                    <>
                      <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                      Generating...
                    </>
                  ) : (
                    <>✨ Generate Chef Timeline</>
                  )}
                </button>
              </div>
            )}

            {/* Share URL notification */}
            {shareUrl && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-800">Timeline link copied to clipboard!</p>
                  <p className="text-xs text-green-600 mt-0.5 break-all">{shareUrl}</p>
                </div>
                <button
                  onClick={() => setShareUrl(null)}
                  className="text-green-600 hover:text-green-800"
                >
                  ×
                </button>
              </div>
            )}

            {/* ChefTimeline component - printable A4 view */}
            <div className="flex-1 overflow-auto bg-white rounded-lg border border-[#E0D4BF] p-6">
              <ChefTimeline
                eventName={eventName}
                eventDate={eventDate}
                serviceStart={serviceStart}
                serviceEnd={serviceEnd}
                guestCount={guestCount}
                operations={timelineEntries.map((entry, idx) => ({
                  id: `op-${idx}`,
                  time: entry.time || entry.day,
                  task: entry.task,
                  duration: "—",
                  category: entry.day.includes("D-0") ? "service" : "prep",
                } as OperationStep))}
                onShare={shareTimeline}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export type { EventCostBreakdown, EventCostItem, EventOperationsTimeline };

