"use client";

import { useMemo, useRef, useState } from "react";

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

type CostItemSource = "estimate" | "invoice" | "manual";

type EventCostBreakdown = {
  ingredients: Array<{
    ingredientName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
    source?: CostItemSource;
    invoiceId?: string;
  }>;
  subtotal: number;
  markupPercent?: number;
  markup?: number;
  staffCost?: number;
  staffCostSource?: CostItemSource;
  transportCost?: number;
  transportCostSource?: CostItemSource;
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

type EventInvoice = {
  id: string;
  name: string;
  uploadedAt: number;
  totalAmount?: number;
  vendor?: string;
  items?: Array<{
    name: string;
    quantity?: number;
    unit?: string;
    unitPrice?: number;
    total: number;
  }>;
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
  // Invoice support
  invoices?: EventInvoice[];
  onUploadInvoice?: (file: File) => Promise<void>;
  onRemoveInvoice?: (invoiceId: string) => void;
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
  invoices = [],
  onUploadInvoice,
  onRemoveInvoice,
}: EventReportProps) {
  const currency = details.currency || "LKR";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showInvoices, setShowInvoices] = useState(false);

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

  // Determine report status based on invoice coverage
  const reportStatus = useMemo(() => {
    if (!costBreakdown || !costBreakdown.ingredients.length) return "incomplete";
    
    // Count items with invoice-verified prices
    const invoiceVerifiedCount = costBreakdown.ingredients.filter(
      (i) => i.source === "invoice" || i.source === "manual"
    ).length;
    
    const totalItems = costBreakdown.ingredients.length;
    
    // "complete" only if ALL items are priced
    if (invoiceVerifiedCount === totalItems) {
      return "complete";
    }
    
    // "partial" if some items priced
    if (invoiceVerifiedCount > 0) {
      return "partial";
    }
    
    return "incomplete";
  }, [costBreakdown, invoices]);

  // Count verified vs awaiting items
  const costStats = useMemo(() => {
    if (!costBreakdown) return { verified: 0, awaiting: 0, total: 0 };
    
    const verified = costBreakdown.ingredients.filter(
      i => i.source === "invoice" || i.source === "manual"
    ).length;
    const total = costBreakdown.ingredients.length;
    
    return {
      verified,
      awaiting: total - verified,
      total,
    };
  }, [costBreakdown]);

  // Handle invoice file upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadInvoice) return;
    
    setUploading(true);
    try {
      await onUploadInvoice(file);
    } catch (err) {
      console.error("Invoice upload failed:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

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

      {/* Hidden file input for invoice upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Report content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-8 py-10">
          
          {/* Report Status Banner */}
          <div className={`mb-6 p-4 rounded-lg border ${
            reportStatus === "complete" 
              ? "bg-green-50 border-green-200" 
              : reportStatus === "partial"
              ? "bg-blue-50 border-blue-200"
              : "bg-amber-50 border-amber-200"
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className={`text-sm font-bold flex items-center gap-2 ${
                  reportStatus === "complete" 
                    ? "text-green-700" 
                    : reportStatus === "partial"
                    ? "text-blue-700"
                    : "text-amber-700"
                }`}>
                  {reportStatus === "complete" ? (
                    <>✅ INVOICE-BACKED REPORT</>
                  ) : reportStatus === "partial" ? (
                    <>📊 PARTIAL VERIFICATION</>
                  ) : (
                    <>📋 AWAITING INVOICES</>
                  )}
                </div>
                <div className={`text-xs mt-1 ${
                  reportStatus === "complete" 
                    ? "text-green-600" 
                    : reportStatus === "partial"
                    ? "text-blue-600"
                    : "text-amber-600"
                }`}>
                  {reportStatus === "complete" ? (
                    <>All {costStats.total} items priced from invoices</>
                  ) : reportStatus === "partial" ? (
                    <>
                      {costStats.verified} of {costStats.total} items from invoices.
                      {costStats.awaiting > 0 && ` ${costStats.awaiting} awaiting invoice.`}
                    </>
                  ) : (
                    <>Upload invoices to complete financial summary.</>
                  )}
                </div>
              </div>
              
              {/* Invoice actions */}
              {viewMode === "chef" && (
                <div className="flex items-center gap-2">
                  {invoices.length > 0 && (
                    <button
                      onClick={() => setShowInvoices(!showInvoices)}
                      className="px-3 py-1.5 text-xs bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                    >
                      📄 {showInvoices ? "Hide" : "View"} Invoices ({invoices.length})
                    </button>
                  )}
                  {onUploadInvoice && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className={`px-3 py-1.5 text-xs rounded-lg transition flex items-center gap-1.5 ${
                        reportStatus === "complete"
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "bg-amber-600 text-white hover:bg-amber-700"
                      } disabled:opacity-50`}
                    >
                      {uploading ? (
                        <>
                          <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                          Uploading...
                        </>
                      ) : (
                        <>📎 {invoices.length > 0 ? "Add Invoice" : "Upload Invoice"}</>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Invoice list (expandable) */}
            {showInvoices && invoices.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-xs font-medium text-gray-700 mb-2">Uploaded Invoices</div>
                <div className="space-y-2">
                  {invoices.map((inv) => (
                    <div 
                      key={inv.id} 
                      className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-200"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-800">{inv.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          {inv.vendor && <span>{inv.vendor}</span>}
                          {inv.totalAmount && (
                            <span className="font-medium text-gray-700">
                              {currency} {inv.totalAmount.toLocaleString()}
                            </span>
                          )}
                          <span>• {new Date(inv.uploadedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {onRemoveInvoice && (
                        <button
                          onClick={() => onRemoveInvoice(inv.id)}
                          className="text-gray-400 hover:text-red-500 transition p-1"
                          title="Remove invoice"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

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
                {reportStatus !== "complete" && (
                  <span className="ml-2 text-xs font-normal text-amber-600">(Awaiting invoices)</span>
                )}
              </h2>
              <div className="space-y-2 text-sm">
                {revenue && (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-[#6F6352]">Revenue</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                        From event brief
                      </span>
                    </div>
                    <span className="font-medium text-[#2F2A25]">
                      {currency} {revenue.toLocaleString()}
                    </span>
                  </div>
                )}
                
                {/* Ingredient Cost with source breakdown */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-[#6F6352]">Ingredient Cost</span>
                    {costStats.awaiting === 0 ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                        ✓ Invoice-backed
                      </span>
                    ) : costStats.verified > 0 ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                        {costStats.awaiting} awaiting invoice
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                        Awaiting invoices
                      </span>
                    )}
                  </div>
                  {costStats.awaiting === 0 ? (
                    <span className="text-[#2F2A25]">
                      {currency} {costBreakdown.subtotal.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-[#A89D8A]">—</span>
                  )}
                </div>
                
                {/* Staff Cost */}
                {costBreakdown.staffCost !== undefined && costBreakdown.staffCost > 0 && (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-[#6F6352]">Staff Cost</span>
                      {costBreakdown.staffCostSource === "invoice" ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                          ✓ From invoice
                        </span>
                      ) : costBreakdown.staffCostSource === "manual" ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          Manual entry
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                          Awaiting invoice
                        </span>
                      )}
                    </div>
                    <span className="text-[#2F2A25]">
                      {currency} {costBreakdown.staffCost.toLocaleString()}
                    </span>
                  </div>
                )}
                
                {/* Transport Cost */}
                {costBreakdown.transportCost !== undefined && costBreakdown.transportCost > 0 && (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-[#6F6352]">Transport</span>
                      {costBreakdown.transportCostSource === "invoice" ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                          ✓ From invoice
                        </span>
                      ) : costBreakdown.transportCostSource === "manual" ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          Manual entry
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                          Awaiting invoice
                        </span>
                      )}
                    </div>
                    <span className="text-[#2F2A25]">
                      {currency} {costBreakdown.transportCost.toLocaleString()}
                    </span>
                  </div>
                )}
                
                {/* Total Cost - only show when complete */}
                {reportStatus === "complete" ? (
                  <div className="flex justify-between items-center pt-2 border-t border-[#E0D4BF]">
                    <div className="flex items-center gap-2">
                      <span className="text-[#6F6352]">Total Cost</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                        ✓ Invoice-backed
                      </span>
                    </div>
                    <span className="font-medium text-[#2F2A25]">
                      {currency} {costBreakdown.total.toLocaleString()}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center pt-2 border-t border-[#E0D4BF]">
                    <span className="text-[#6F6352]">Total Cost</span>
                    <span className="text-[#A89D8A]">Awaiting invoices</span>
                  </div>
                )}
                
                {/* Net Margin - only show when complete */}
                {reportStatus === "complete" && margin !== null && (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-[#6F6352]">Net Margin</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                        Revenue − Cost
                      </span>
                    </div>
                    <span className="font-bold text-[#2F2A25]">
                      {currency} {margin.toLocaleString()} ({marginPercent}%)
                    </span>
                  </div>
                )}
                {reportStatus !== "complete" && (
                  <div className="flex justify-between items-center">
                    <span className="text-[#6F6352]">Net Margin</span>
                    <span className="text-[#A89D8A]">Available after invoices uploaded</span>
                  </div>
                )}
              </div>
              
              {/* Incomplete notice */}
              {reportStatus !== "complete" && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-amber-700">
                    <span>🔒</span>
                    <span>
                      <strong>Awaiting invoices:</strong> Upload invoices to complete the financial summary.
                    </span>
                  </div>
                </div>
              )}
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

export type { EventReportProps, EventInvoice, CostItemSource };

