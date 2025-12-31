"use client";

import { useMemo } from "react";

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

type EventDetails = {
  occasion?: string;
  guests?: number;
  location?: string;
  pricingModel?: "per_head" | "event_total";
  priceAmount?: number;
  currency?: string;
  date?: string;
  serviceStart?: string;
  serviceEnd?: string;
  kitchen?: {
    onSitePrep?: boolean;
    externalKitchen?: boolean;
    transportRequired?: boolean;
  };
};

type EventMenuCourse = {
  type: "starter" | "main" | "dessert" | "side" | "beverage";
  recipeIds: string[];
};

type EventMenu = {
  courses: EventMenuCourse[];
  guestCount: number;
};

type EventCostBreakdown = {
  ingredients: Array<{
    ingredientName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  markupPercent?: number;
  markup?: number;
  staffCost?: number;
  transportCost?: number;
  total: number;
};

type EventOperationsTimeline = {
  entries: Array<{
    day: string;
    time?: string;
    task: string;
  }>;
};

type EventRisk = {
  severity: "high" | "medium" | "low" | "ok";
  description: string;
  mitigation?: string;
};

type EventVerdict = "proceed" | "adjust" | "decline" | null;

type Recipe = {
  id: string;
  name: string;
  description?: string;
};

interface EventReportProps {
  eventName: string;
  details: EventDetails;
  menu: EventMenu;
  recipes: Recipe[];
  costBreakdown: EventCostBreakdown | null;
  operations: EventOperationsTimeline | null;
  risks: EventRisk[];
  verdict: EventVerdict;
  verdictNotes?: string;
  verdictDate?: number;
  viewMode?: "chef" | "client" | "venue";
  onExport?: (format: "pdf" | "excel" | "email" | "whatsapp") => void;
}

const COURSE_LABELS: Record<string, string> = {
  starter: "Starters",
  main: "Mains",
  dessert: "Desserts",
  side: "Sides",
  beverage: "Beverages",
};

// ────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ────────────────────────────────────────────────────────────────────────────

export function EventReport({
  eventName,
  details,
  menu,
  recipes,
  costBreakdown,
  operations,
  risks,
  verdict,
  verdictNotes,
  verdictDate,
  viewMode = "chef",
  onExport,
}: EventReportProps) {
  const currency = details.currency || "LKR";

  // Calculate revenue
  const revenue = useMemo(() => {
    if (!details.priceAmount) return null;
    if (details.pricingModel === "per_head" && details.guests) {
      return details.priceAmount * details.guests;
    }
    return details.priceAmount;
  }, [details]);

  // Get recipe names by ID
  const getRecipeName = (id: string) => recipes.find((r) => r.id === id)?.name || "Unknown Recipe";

  // Group courses by type
  const coursesByType = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    menu.courses.forEach((c) => {
      if (!grouped[c.type]) grouped[c.type] = [];
      c.recipeIds.forEach((id) => grouped[c.type].push(getRecipeName(id)));
    });
    return grouped;
  }, [menu.courses, recipes]);

  // Calculate margin
  const margin = revenue && costBreakdown?.total ? revenue - costBreakdown.total : null;
  const marginPercent = revenue && costBreakdown?.total 
    ? Math.round(((revenue - costBreakdown.total) / revenue) * 100) 
    : null;

  // Filter risks for display
  const significantRisks = risks.filter((r) => r.severity !== "ok");

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Export toolbar */}
      {onExport && (
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-b border-[#E0D4BF] bg-[#FAF8F4]">
          <div className="mr-auto text-xs text-[#8B7E6A]">
            View: {viewMode === "chef" ? "Chef" : viewMode === "client" ? "Client" : "Venue"}
          </div>
          <button
            onClick={() => onExport("pdf")}
            className="px-3 py-1.5 text-sm bg-[#2F2A25] text-white rounded-lg hover:bg-[#4A331D] transition"
          >
            PDF
          </button>
          <button
            onClick={() => onExport("excel")}
            className="px-3 py-1.5 text-sm bg-[#E8DFD0] text-[#4A331D] rounded-lg hover:bg-[#DED4C3] transition"
          >
            Excel
          </button>
          <button
            onClick={() => onExport("email")}
            className="px-3 py-1.5 text-sm bg-[#E8DFD0] text-[#4A331D] rounded-lg hover:bg-[#DED4C3] transition"
          >
            Email
          </button>
          <button
            onClick={() => onExport("whatsapp")}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            WhatsApp
          </button>
        </div>
      )}

      {/* Report content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-8 py-10">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#2F2A25] mb-2">{eventName}</h1>
            <p className="text-lg text-[#6F6352]">
              {details.location && `${details.location} · `}
              {details.date}
            </p>
            {details.guests && (
              <p className="text-sm text-[#8B7E6A] mt-1">{details.guests} guests</p>
            )}
          </div>

          {/* Verdict banner */}
          {verdict && (
            <div className={`mb-8 p-4 rounded-lg text-center ${
              verdict === "proceed" ? "bg-green-50 border border-green-200" :
              verdict === "adjust" ? "bg-amber-50 border border-amber-200" :
              "bg-red-50 border border-red-200"
            }`}>
              <div className={`text-lg font-bold ${
                verdict === "proceed" ? "text-green-700" :
                verdict === "adjust" ? "text-amber-700" :
                "text-red-700"
              }`}>
                VERDICT: {verdict.toUpperCase()}
              </div>
              {verdictDate && (
                <div className="text-sm text-[#8B7E6A] mt-1">
                  Confirmed {new Date(verdictDate).toLocaleDateString()}
                </div>
              )}
              {verdictNotes && (
                <div className="text-sm text-[#6F6352] mt-2 italic">"{verdictNotes}"</div>
              )}
            </div>
          )}

          {/* Event Summary */}
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-[#8B7E6A] uppercase tracking-wider mb-3 border-b border-[#E0D4BF] pb-2">
              Event Summary
            </h2>
            <ul className="space-y-1 text-[#4A331D]">
              {details.guests && <li>• {details.guests} guests</li>}
              {details.occasion && <li>• {details.occasion}</li>}
              {details.priceAmount && (
                <li>
                  • Price: {currency} {details.priceAmount.toLocaleString()}
                  {details.pricingModel === "per_head" ? " per head" : " total"}
                </li>
              )}
              {details.serviceStart && details.serviceEnd && (
                <li>• Service: {details.serviceStart} - {details.serviceEnd}</li>
              )}
            </ul>
          </section>

          {/* Menu */}
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-[#8B7E6A] uppercase tracking-wider mb-3 border-b border-[#E0D4BF] pb-2">
              Menu
            </h2>
            {Object.entries(coursesByType).map(([type, recipeNames]) => (
              <div key={type} className="mb-4">
                <h3 className="text-sm font-medium text-[#4A331D] mb-1">
                  {COURSE_LABELS[type] || type}
                </h3>
                <ul className="space-y-0.5 text-[#6F6352]">
                  {recipeNames.map((name, idx) => (
                    <li key={idx}>• {name}</li>
                  ))}
                </ul>
              </div>
            ))}
            {Object.keys(coursesByType).length === 0 && (
              <p className="text-[#8B7E6A] italic">No menu designed yet</p>
            )}
          </section>

          {/* Financial Summary (chef view only) */}
          {viewMode === "chef" && costBreakdown && (
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-[#8B7E6A] uppercase tracking-wider mb-3 border-b border-[#E0D4BF] pb-2">
                Financial Summary
              </h2>
              <div className="space-y-2 text-sm">
                {revenue && (
                  <div className="flex justify-between">
                    <span className="text-[#6F6352]">Revenue</span>
                    <span className="font-medium text-[#2F2A25]">
                      {currency} {revenue.toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#6F6352]">Ingredient Cost</span>
                  <span className="text-[#2F2A25]">
                    {currency} {costBreakdown.subtotal.toLocaleString()}
                  </span>
                </div>
                {costBreakdown.staffCost && (
                  <div className="flex justify-between">
                    <span className="text-[#6F6352]">Staff Cost</span>
                    <span className="text-[#2F2A25]">
                      {currency} {costBreakdown.staffCost.toLocaleString()}
                    </span>
                  </div>
                )}
                {costBreakdown.transportCost && (
                  <div className="flex justify-between">
                    <span className="text-[#6F6352]">Transport</span>
                    <span className="text-[#2F2A25]">
                      {currency} {costBreakdown.transportCost.toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-[#E0D4BF]">
                  <span className="text-[#6F6352]">Total Cost</span>
                  <span className="font-medium text-[#2F2A25]">
                    {currency} {costBreakdown.total.toLocaleString()}
                  </span>
                </div>
                {margin !== null && (
                  <div className="flex justify-between">
                    <span className="text-[#6F6352]">Net Margin</span>
                    <span className={`font-bold ${marginPercent && marginPercent >= 25 ? "text-green-600" : "text-amber-600"}`}>
                      {currency} {margin.toLocaleString()} ({marginPercent}%)
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Operations (chef/venue view) */}
          {(viewMode === "chef" || viewMode === "venue") && operations && operations.entries.length > 0 && (
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-[#8B7E6A] uppercase tracking-wider mb-3 border-b border-[#E0D4BF] pb-2">
                Operations
              </h2>
              <div className="space-y-1 text-sm">
                {details.kitchen?.externalKitchen && (
                  <p className="text-[#6F6352]">Prep Location: External kitchen</p>
                )}
                {details.kitchen?.transportRequired && (
                  <p className="text-[#6F6352]">Transport: Required</p>
                )}
                <div className="mt-3 space-y-1">
                  {operations.entries.map((entry, idx) => (
                    <div key={idx} className="text-[#4A331D]">
                      <span className="font-medium">{entry.day}</span>
                      {entry.time && <span className="ml-2 text-[#8B7E6A]">{entry.time}</span>}
                      <span className="ml-3">{entry.task}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Risks/Notes (chef view) */}
          {viewMode === "chef" && significantRisks.length > 0 && (
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-[#8B7E6A] uppercase tracking-wider mb-3 border-b border-[#E0D4BF] pb-2">
                Notes
              </h2>
              <ul className="space-y-1 text-sm text-[#6F6352]">
                {significantRisks.map((risk, idx) => (
                  <li key={idx}>
                    • {risk.description}
                    {risk.mitigation && ` → ${risk.mitigation}`}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Footer */}
          <div className="mt-12 pt-4 border-t border-[#E0D4BF] text-center text-xs text-[#8B7E6A]">
            Generated {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}

export type { EventReportProps };

