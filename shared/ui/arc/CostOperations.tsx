"use client";

import { useMemo, useState } from "react";
import {
  calculateCostPerGuestRounded,
  calculateDisplayedSubtotal,
  calculateMarkup,
  calculateSubtotalFromTotals,
  calculateTotal,
  splitIngredientsByPricing,
} from "@/app/lib/core/pricing/costMath";

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

type EventCostItem = {
  ingredientName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  source: "invoice" | "market_avg" | "manual" | "unknown";
  total: number;
  verified: boolean;
  // Flag for ingredients without pricing data
  priceUnknown?: boolean;
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

interface CostOperationsProps {
  costBreakdown: EventCostBreakdown | null;
  operations: EventOperationsTimeline | null;
  currency: string;
  guestCount: number;
  invoices: Invoice[];
  onUpdateCost: (cost: EventCostBreakdown) => void;
  onUpdateOperations: (ops: EventOperationsTimeline) => void;
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
}: CostOperationsProps) {
  const [activeTab, setActiveTab] = useState<"cost" | "operations">("cost");
  const [markupPercent, setMarkupPercent] = useState(costBreakdown?.markupPercent || 30);
  const [staffCost, setStaffCost] = useState(costBreakdown?.staffCost || 0);
  const [transportCost, setTransportCost] = useState(costBreakdown?.transportCost || 0);

  // Initialize cost breakdown if empty
  const ingredients = costBreakdown?.ingredients || [];

  // Calculate totals (exclude items with unknown prices)
  const { pricedIngredients, unknownPriceIngredients } = splitIngredientsByPricing(ingredients);
  const subtotal = calculateDisplayedSubtotal(pricedIngredients);
  const markup = calculateMarkup(subtotal, markupPercent);
  const total = calculateTotal(subtotal, markup, staffCost, transportCost);

  // Find price from invoices
  const findPriceFromInvoice = (ingredientName: string): { price: number; source: string } | null => {
    for (const invoice of invoices) {
      if (!invoice.items) continue;
      for (const item of invoice.items) {
        if (item.name.toLowerCase().includes(ingredientName.toLowerCase())) {
          const price = parseFloat(item.unitPrice || "0");
          if (price > 0) {
            return { price, source: invoice.vendor || "Invoice" };
          }
        }
      }
    }
    return null;
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

  return (
    <div className="h-full flex flex-col bg-[#FAF8F4]">
      {/* At-a-glance summary */}
      <div className="px-6 py-4 border-b border-[#E0D4BF] bg-[#FBF4E8]">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-[#E0D4BF] rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider text-[#8B7E6A]">Guests</div>
            <div className="text-sm font-medium text-[#2F2A25]">{guestCount || "—"}</div>
          </div>
          <div className="bg-white border border-[#E0D4BF] rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider text-[#8B7E6A]">Total cost</div>
            <div className="text-sm font-semibold text-[#2F2A25]">
              {currency} {total.toLocaleString()}
            </div>
          </div>
          <div className="bg-white border border-[#E0D4BF] rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider text-[#8B7E6A]">Cost / guest</div>
            <div className="text-sm font-medium text-[#2F2A25]">
              {calculateCostPerGuestRounded(total, guestCount) !== null
                ? `${currency} ${calculateCostPerGuestRounded(total, guestCount)!.toLocaleString()}`
                : "—"}
            </div>
          </div>
          <div className="bg-white border border-[#E0D4BF] rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider text-[#8B7E6A]">Markup</div>
            <div className="text-sm font-medium text-[#2F2A25]">{markupPercent}%</div>
          </div>
        </div>
      </div>

      {/* Unknown price warning */}
      {unknownPriceIngredients.length > 0 && (
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-200">
          <div className="flex items-start gap-2">
            <span className="text-amber-500 font-bold">⚠</span>
            <div>
              <div className="text-sm font-medium text-amber-800">
                {unknownPriceIngredients.length} ingredient{unknownPriceIngredients.length > 1 ? "s" : ""} need pricing
              </div>
              <div className="text-xs text-amber-700 mt-1">
                {unknownPriceIngredients.slice(0, 3).map((i) => i.ingredientName || "Unknown").join(", ")}
                {unknownPriceIngredients.length > 3 && ` and ${unknownPriceIngredients.length - 3} more`}
              </div>
              <p className="text-xs text-amber-600 mt-1">
                Items without pricing are excluded from totals. Enter prices manually or research local market rates.
              </p>
            </div>
          </div>
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
          Cost Breakdown
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
          <div className="space-y-6">
            {/* Ingredients table */}
            <div>
              <h3 className="text-sm font-semibold text-[#4A331D] uppercase tracking-wider mb-3">
                Ingredient Costs
              </h3>
              <div className="bg-white border border-[#E0D4BF] rounded-lg overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[2fr,1fr,0.8fr,1fr,0.8fr,1fr,40px] gap-2 px-4 py-2 text-[10px] uppercase tracking-wider text-[#8B7E6A] bg-[#FAF2E6] border-b border-[#E0D4BF]">
                  <div>Ingredient</div>
                  <div className="text-right">Qty</div>
                  <div>Unit</div>
                  <div className="text-right">Unit Price</div>
                  <div>Source</div>
                  <div className="text-right">Total</div>
                  <div></div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-[#E0D4BF]">
                  {ingredients.map((item, idx) => {
                    const invoicePrice = findPriceFromInvoice(item.ingredientName);
                    const hasUnknownPrice = item.priceUnknown || !item.unitPrice || item.unitPrice <= 0 || isNaN(item.unitPrice);
                    return (
                      <div
                        key={idx}
                        className={`grid grid-cols-[2fr,1fr,0.8fr,1fr,0.8fr,1fr,40px] gap-2 px-4 py-2 items-center ${
                          hasUnknownPrice ? "bg-amber-50 border-l-2 border-l-amber-400" : ""
                        }`}
                      >
                        <input
                          type="text"
                          value={item.ingredientName}
                          onChange={(e) => updateIngredient(idx, { ingredientName: e.target.value })}
                          placeholder="Ingredient name"
                          className="text-sm text-[#2F2A25] bg-transparent focus:outline-none focus:bg-[#FAF8F4] px-1 rounded"
                        />
                        <input
                          type="number"
                          value={item.quantity || ""}
                          onChange={(e) => updateIngredient(idx, { quantity: parseFloat(e.target.value) || 0 })}
                          className="text-sm text-[#2F2A25] text-right bg-transparent focus:outline-none focus:bg-[#FAF8F4] px-1 rounded"
                        />
                        <select
                          value={item.unit}
                          onChange={(e) => updateIngredient(idx, { unit: e.target.value })}
                          className="text-sm text-[#6F6352] bg-transparent focus:outline-none"
                        >
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="L">L</option>
                          <option value="ml">ml</option>
                          <option value="pcs">pcs</option>
                          <option value="bunch">bunch</option>
                        </select>
                        <div className="relative">
                          <input
                            type="number"
                            value={item.unitPrice || ""}
                            onChange={(e) => updateIngredient(idx, { 
                              unitPrice: parseFloat(e.target.value) || 0,
                              source: "manual",
                              verified: true,
                            })}
                            className="w-full text-sm text-[#2F2A25] text-right bg-transparent focus:outline-none focus:bg-[#FAF8F4] px-1 rounded"
                          />
                          {invoicePrice && !item.verified && (
                            <button
                              onClick={() => updateIngredient(idx, {
                                unitPrice: invoicePrice.price,
                                source: "invoice",
                                verified: true,
                              })}
                              className="absolute -right-1 top-1/2 -translate-y-1/2 text-[10px] text-amber-600 hover:text-amber-800"
                              title={`Use ${invoicePrice.source} price: ${invoicePrice.price}`}
                            >
                              💡
                            </button>
                          )}
                        </div>
                        <div className={`text-xs ${
                          item.source === "invoice" ? "text-green-600" :
                          item.source === "market_avg" ? "text-blue-600" :
                          "text-[#8B7E6A]"
                        }`}>
                          {item.source === "invoice" ? "Invoice" :
                           item.source === "market_avg" ? "Market" : "Manual"}
                        </div>
                        <div className="text-sm font-medium text-[#2F2A25] text-right">
                          {currency} {item.total.toLocaleString()}
                        </div>
                        <button
                          onClick={() => removeIngredient(idx)}
                          className="text-[#8B7E6A] hover:text-red-500 text-center"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Add button */}
                <button
                  onClick={addIngredient}
                  className="w-full py-2 text-sm text-[#8B7E6A] hover:text-[#4A331D] hover:bg-[#FAF8F4] transition"
                >
                  + Add ingredient
                </button>
              </div>
            </div>

            {/* Cost summary */}
            <div className="bg-[#FBF4E8] border border-[#E0D4BF] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-[#4A331D] uppercase tracking-wider mb-3">
                Cost Summary
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#6F6352]">Ingredient subtotal</span>
                  <span className="text-[#2F2A25]">{currency} {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-[#6F6352]">Markup</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={markupPercent}
                      onChange={(e) => {
                        setMarkupPercent(parseFloat(e.target.value) || 0);
                        setTimeout(updateOtherCosts, 100);
                      }}
                      className="w-16 px-2 py-1 text-sm text-right bg-white border border-[#E0D4BF] rounded"
                    />
                    <span className="text-[#8B7E6A]">%</span>
                    <span className="text-[#2F2A25]">{currency} {markup.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-[#6F6352]">Staff cost</span>
                  <input
                    type="number"
                    value={staffCost || ""}
                    onChange={(e) => {
                      setStaffCost(parseFloat(e.target.value) || 0);
                      setTimeout(updateOtherCosts, 100);
                    }}
                    className="w-32 px-2 py-1 text-sm text-right bg-white border border-[#E0D4BF] rounded"
                  />
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-[#6F6352]">Transport</span>
                  <input
                    type="number"
                    value={transportCost || ""}
                    onChange={(e) => {
                      setTransportCost(parseFloat(e.target.value) || 0);
                      setTimeout(updateOtherCosts, 100);
                    }}
                    className="w-32 px-2 py-1 text-sm text-right bg-white border border-[#E0D4BF] rounded"
                  />
                </div>
                <div className="pt-2 border-t border-[#E0D4BF] flex justify-between">
                  <span className="text-sm font-semibold text-[#4A331D]">Total</span>
                  <span className="text-lg font-bold text-[#2F2A25]">
                    {currency} {total.toLocaleString()}
                  </span>
                </div>
                {guestCount > 0 && (
                  <div className="flex justify-between text-xs text-[#8B7E6A]">
                    <span>Cost per guest</span>
                    <span>{currency} {Math.round(total / guestCount).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "operations" && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#4A331D] uppercase tracking-wider">
              Operations Timeline
            </h3>

            <div className="bg-white border border-[#E0D4BF] rounded-lg overflow-hidden">
              {/* Timeline entries */}
              <div className="divide-y divide-[#E0D4BF]">
                {timelineEntries.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-4 py-3">
                    <select
                      value={entry.day}
                      onChange={(e) => updateTimelineEntry(idx, { day: e.target.value })}
                      className="px-2 py-1 bg-[#FAF8F4] border border-[#E0D4BF] rounded text-sm text-[#4A331D]"
                    >
                      <option value="D-3">D-3</option>
                      <option value="D-2">D-2</option>
                      <option value="D-1">D-1</option>
                      <option value="D-0">D-0</option>
                    </select>
                    <input
                      type="time"
                      value={entry.time || ""}
                      onChange={(e) => updateTimelineEntry(idx, { time: e.target.value })}
                      className="px-2 py-1 bg-[#FAF8F4] border border-[#E0D4BF] rounded text-sm text-[#4A331D]"
                    />
                    <input
                      type="text"
                      value={entry.task}
                      onChange={(e) => updateTimelineEntry(idx, { task: e.target.value })}
                      placeholder="Task description"
                      className="flex-1 px-3 py-1 bg-transparent text-sm text-[#2F2A25] focus:outline-none focus:bg-[#FAF8F4] rounded"
                    />
                    <button
                      onClick={() => removeTimelineEntry(idx)}
                      className="text-[#8B7E6A] hover:text-red-500"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Add entry */}
              <button
                onClick={addTimelineEntry}
                className="w-full py-3 text-sm text-[#8B7E6A] hover:text-[#4A331D] hover:bg-[#FAF8F4] transition border-t border-[#E0D4BF]"
              >
                + Add timeline entry
              </button>
            </div>

            {/* Suggested timeline */}
            {timelineEntries.length === 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="text-sm font-medium text-amber-800 mb-2">Suggested Timeline</div>
                <ul className="text-xs text-amber-700 space-y-1">
                  <li>• D-2: Protein marinade, sauce prep</li>
                  <li>• D-1: Vegetable prep, mise en place</li>
                  <li>• D-0 2:00 PM: Arrive and setup</li>
                  <li>• D-0 3:00 PM: Start cooking</li>
                  <li>• D-0 6:30 PM: Service begins</li>
                </ul>
                <button
                  onClick={() => {
                    onUpdateOperations({
                      entries: [
                        { day: "D-2", task: "Protein marinade, sauce prep" },
                        { day: "D-1", task: "Vegetable prep, mise en place" },
                        { day: "D-0", time: "14:00", task: "Arrive and setup" },
                        { day: "D-0", time: "15:00", task: "Start cooking" },
                        { day: "D-0", time: "18:30", task: "Service begins" },
                      ],
                    });
                  }}
                  className="mt-3 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs rounded-lg transition"
                >
                  Use suggested timeline
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export type { EventCostBreakdown, EventCostItem, EventOperationsTimeline };

