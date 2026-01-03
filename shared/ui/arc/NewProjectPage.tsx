"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShoppingListItem } from "@/app/lib/core/shared/types";
import { normalizeIngredientName } from "@/app/lib/core/invoice/normalize";
import { MenuDesign } from "./MenuDesign";
import { CostOperations } from "./CostOperations";
import { VerdictPage } from "./VerdictPage";
import { EventReport } from "./EventReport";

// ────────────────────────────────────────────────────────────────────────────
// TYPES (matching dashboard/page.tsx)
// ────────────────────────────────────────────────────────────────────────────

type EventProjectPhase = 
  | "idea"
  | "clarify"
  | "menu"
  | "cost"
  | "verdict"
  | "report";

type EventPricingModel = "per_head" | "event_total";

type EventKitchenSituation = {
  onSitePrep: boolean;
  externalKitchen: boolean;
  transportRequired: boolean;
};

type EventMenuStyle = "course_meal" | "buffet" | "street_food";

type EventDetails = {
  occasion?: string;
  guests?: number;
  location?: string;
  pricingModel?: EventPricingModel;
  priceAmount?: number;
  currency?: string;
  kitchen?: EventKitchenSituation;
  date?: string;
  serviceStart?: string;
  serviceEnd?: string;
  // Multi-day event support
  multiDay?: boolean;
  numberOfDays?: number;
  // Menu/service style
  menuStyle?: EventMenuStyle;
  // Dietary requirements extracted from brief
  dietaryRequirements?: string[];
  // Seating & staffing
  seatingStyle?: string;
  staffCount?: number;
};

type EventMenuCourse = {
  id: string;
  type: "starter" | "main" | "dessert" | "side" | "beverage";
  recipeIds: string[];
};

type EventMenu = {
  courses: EventMenuCourse[];
  guestCount: number;
  prepTimeEstimate?: number;
};

// ShoppingListItem imported from @/app/lib/core/shared/types

type EventCostItem = {
  ingredientName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  source: "invoice" | "historical-invoice" | "manual" | "unknown";
  total: number;
  verified: boolean;
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

type EventRisk = {
  id: string;
  severity: "high" | "medium" | "low" | "ok";
  category: "staffing" | "equipment" | "timing" | "ingredients" | "weather" | "budget";
  description: string;
  mitigation?: string;
};

type EventVerdict = "proceed" | "adjust" | "decline" | null;

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

type EventProject = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  phase: EventProjectPhase;
  freeformNotes: string;
  uploadedFileIds: string[];
  details: EventDetails;
  unknowns: string[];
  constraints: string[];
  menu: EventMenu;
  shoppingList: ShoppingListItem[];
  costBreakdown: EventCostBreakdown | null;
  operations: EventOperationsTimeline | null;
  risks: EventRisk[];
  verdict: EventVerdict;
  verdictNotes?: string;
  verdictDate?: number;
  folderId?: string | null;
  // Invoice support for report
  invoices?: EventInvoice[];
};

type UploadedFile = {
  id: string;
  name: string;
  role?: "recipe" | "invoice" | "event" | "note";
  extractedText?: string | null;
};

type Recipe = {
  id: string;
  name: string;
  cuisine?: string;
  category?: string;
  prepTime?: number;
  dietary?: string[];
  servings?: number;
  ingredients?: Array<{
    name: string;
    quantity: number | null;
    unit: string | null;
    preparation?: string;
    category?: "fresh" | "dry" | "other";
  }>;
};

type Invoice = {
  id: string;
  vendor?: string;
  items?: Array<{
    name: string;
    unitPrice?: string;
    unit?: string;
  }>;
};

// ────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ────────────────────────────────────────────────────────────────────────────

interface NewProjectPageProps {
  event: EventProject;
  onUpdate: (updates: Partial<EventProject>) => void;
  onClose: () => void;
  // Draft support: draft should not be treated as a saved project until onSave is called.
  isDraft?: boolean;
  onSave?: () => void;
  // When changed, the upload file picker will auto-open once.
  autoOpenUploadKey?: number;
  ingestionStatus?: {
    status: "not_started" | "processing" | "attempted" | "failed";
    attemptedAt?: number;
    extractedChars?: number;
    fileCount?: number;
    error?: string;
  };
  onUpload: (files: FileList) => Promise<string[]>;
  uploadedFiles: UploadedFile[];
  recipes?: Recipe[];
  invoices?: Invoice[];
  // Invoice upload for report phase
  onUploadReportInvoice?: (file: File) => Promise<void>;
  onRemoveReportInvoice?: (invoiceId: string) => void;
}

const OCCASION_OPTIONS = [
  "Wedding",
  "Anniversary dinner",
  "Corporate event",
  "Birthday party",
  "Private dinner",
  "Pop-up event",
  "Catering",
  "Other",
];

// User-facing phase labels (chef-friendly language)
// Internal phase values remain unchanged for backward compatibility
const PHASE_LABELS: Record<EventProjectPhase, string> = {
  idea: "Notes",
  clarify: "Event Brief",
  menu: "Menu Design",
  cost: "Cost & Operations",
  verdict: "Decision",
  report: "Client Output",
};

const PHASE_ORDER: EventProjectPhase[] = ["idea", "clarify", "menu", "cost", "verdict", "report"];

export function NewProjectPage({
  event,
  onUpdate,
  onClose,
  isDraft,
  onSave,
  autoOpenUploadKey,
  ingestionStatus,
  onUpload,
  uploadedFiles,
  recipes = [],
  invoices = [],
  onUploadReportInvoice,
  onRemoveReportInvoice,
}: NewProjectPageProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localNotes, setLocalNotes] = useState(event.freeformNotes);
  const [isDragging, setIsDragging] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<EventProjectPhase>(event.phase);
  const lastAutoOpenUploadKeyRef = useRef<number | null>(null);
  const [showSourceText, setShowSourceText] = useState(false);

  // Sync local phase with parent when event.phase changes (e.g., after upload)
  useEffect(() => {
    if (event.phase !== currentPhase) {
      setCurrentPhase(event.phase);
    }
  }, [event.phase]);

  // Focus textarea on mount for idea phase
  useEffect(() => {
    if (textareaRef.current && currentPhase === "idea") {
      textareaRef.current.focus();
    }
  }, [currentPhase]);

  // Auto-open upload picker when requested by parent (e.g., "Upload event brief" CTA).
  useEffect(() => {
    if (autoOpenUploadKey == null) return;
    if (lastAutoOpenUploadKeyRef.current === autoOpenUploadKey) return;
    lastAutoOpenUploadKeyRef.current = autoOpenUploadKey;
    requestAnimationFrame(() => fileInputRef.current?.click());
  }, [autoOpenUploadKey]);


  // Debounced save for notes
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (localNotes !== event.freeformNotes) {
        onUpdate({ freeformNotes: localNotes });
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [localNotes, event.freeformNotes, onUpdate]);

  // ─────────────────────────────────────────────────────────────────────────
  // AUTO-DERIVE SHOPPING LIST FROM MENU
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Get all recipe IDs from menu courses
    const menuRecipeIds = event.menu.courses.flatMap((c) => c.recipeIds);
    if (menuRecipeIds.length === 0) {
      // No recipes in menu - clear shopping list if it has items
      if (event.shoppingList && event.shoppingList.length > 0) {
        onUpdate({ shoppingList: [] });
      }
      return;
    }

    // Get recipes that are in the menu
    const menuRecipes = recipes.filter((r) => menuRecipeIds.includes(r.id));
    if (menuRecipes.length === 0) return;

    const guestCount = event.details.guests || event.menu.guestCount || 1;

    // ─────────────────────────────────────────────────────────────────────────
    // DIFF 4: Canonical ingredient normalization
    // Aggregate on canonical key to prevent duplicates (onion vs onions, etc.)
    // ─────────────────────────────────────────────────────────────────────────
    const aggregated: Record<string, {
      canonicalKey: string;      // For aggregation
      displayName: string;       // Best display name seen
      totalQuantity: number;
      unit: string;
      sources: string[];
      category?: "fresh" | "dry" | "other";
    }> = {};

    menuRecipes.forEach((recipe) => {
      if (!recipe.ingredients) return;

      // Scale factor: recipe servings to guest count
      const recipeServings = recipe.servings || 4;
      const scaleFactor = guestCount / recipeServings;

      recipe.ingredients.forEach((ing) => {
        // Normalize ingredient name for canonical matching
        const normalized = normalizeIngredientName(ing.name);
        const canonicalKey = normalized.key;
        const displayName = ing.name.trim();
        const scaledQty = (ing.quantity || 0) * scaleFactor;
        const unit = ing.unit || "pcs";

        // Create aggregation key: canonical name + unit
        const aggKey = `${canonicalKey}::${unit.toLowerCase()}`;

        if (aggregated[aggKey]) {
          // Same canonical ingredient + unit - add quantities
          aggregated[aggKey].totalQuantity += scaledQty;
          if (!aggregated[aggKey].sources.includes(recipe.name)) {
            aggregated[aggKey].sources.push(recipe.name);
          }
          // Keep the shorter display name (usually more canonical)
          if (displayName.length < aggregated[aggKey].displayName.length) {
            aggregated[aggKey].displayName = displayName;
          }
        } else {
          aggregated[aggKey] = {
            canonicalKey,
            displayName,
            totalQuantity: scaledQty,
            unit,
            sources: [recipe.name],
            category: ing.category,
          };
        }
      });
    });

    // Convert to ShoppingListItem array with canonical names
    const derivedList: ShoppingListItem[] = Object.values(aggregated).map((data) => ({
      ingredientName: data.displayName.charAt(0).toUpperCase() + data.displayName.slice(1).toLowerCase(),
      quantity: Math.round(data.totalQuantity * 100) / 100,
      unit: data.unit,
      sources: data.sources,
      category: data.category,
    }));

    // Sort for stable comparison (by ingredientName lowercase, then unit)
    const sortKey = (item: ShoppingListItem) => 
      `${item.ingredientName.toLowerCase()}::${item.unit}`;
    
    const sortedDerived = [...derivedList].sort((a, b) => 
      sortKey(a).localeCompare(sortKey(b))
    );
    
    const sortedCurrent = [...(event.shoppingList || [])].sort((a, b) => 
      sortKey(a).localeCompare(sortKey(b))
    );

    // Minimal compare shape: only compare identity + quantity
    const toCompareShape = (list: ShoppingListItem[]) => 
      list.map((i) => ({ n: i.ingredientName.toLowerCase(), q: i.quantity, u: i.unit }));

    const currentStr = JSON.stringify(toCompareShape(sortedCurrent));
    const newStr = JSON.stringify(toCompareShape(sortedDerived));
    
    if (currentStr !== newStr) {
      onUpdate({ shoppingList: sortedDerived });
    }
  }, [event.menu.courses, event.details.guests, event.menu.guestCount, recipes, event.shoppingList, onUpdate]);

  // File drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      const newIds = await onUpload(e.dataTransfer.files);
      onUpdate({ uploadedFileIds: [...event.uploadedFileIds, ...newIds] });
      // Navigate to Clarify after upload
      setCurrentPhase("clarify");
      onUpdate({ phase: "clarify" });
    }
  }, [onUpload, onUpdate, event.uploadedFileIds]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newIds = await onUpload(e.target.files);
      onUpdate({ uploadedFileIds: [...event.uploadedFileIds, ...newIds] });
      // Navigate to Clarify after upload
      setCurrentPhase("clarify");
      onUpdate({ phase: "clarify" });
      e.target.value = "";
    }
  }, [onUpload, onUpdate, event.uploadedFileIds]);

  const removeFile = (fileId: string) => {
    onUpdate({ uploadedFileIds: event.uploadedFileIds.filter((id) => id !== fileId) });
  };

  const deriveStructuredTitle = () => {
    const occasion = event.details.occasion?.trim();
    const location = event.details.location?.trim();
    const date = event.details.date?.trim();

    const left = occasion || "Event";
    const right = location || date || "";

    const base = right ? `${left} — ${right}` : left;
    return base.length > 60 ? `${base.slice(0, 57)}…` : base;
  };

  // Persist an intentional title derived from structured details (not from idea notes).
  useEffect(() => {
    const derived = deriveStructuredTitle();
    const hasEnoughStructuredInfo = !!(event.details.occasion || event.details.location || event.details.date);
    const isDefaultName = !event.name || event.name.trim() === "" || event.name === "New Event";
    if (!hasEnoughStructuredInfo) return;
    if (!isDefaultName) return;
    if (!derived || derived === "Event") return;
    if (derived === event.name) return;
    onUpdate({ name: derived });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.details.occasion, event.details.location, event.details.date]);

  // Update details
  const updateDetails = (updates: Partial<EventDetails>) => {
    onUpdate({ details: { ...event.details, ...updates } });
  };

  // Navigate to phase (free navigation between all phases)
  const goToPhase = (phase: EventProjectPhase) => {
    setCurrentPhase(phase);
    onUpdate({ phase });
  };

  // Get attached files
  const attachedFiles = event.uploadedFileIds
    .map((id) => uploadedFiles.find((f) => f.id === id))
    .filter(Boolean) as UploadedFile[];

  const isReviewMode =
    (ingestionStatus?.status === "attempted" || ingestionStatus?.status === "failed") &&
    attachedFiles.length > 0;
  const isProcessing = ingestionStatus?.status === "processing";

  // Detect what needs confirmation (based on actual displayed values, not OCR)
  const unknowns: string[] = [];
  const isDefaultName =
    !event.name || event.name.trim() === "" || event.name.trim() === "New Event";
  if (isDefaultName) unknowns.push("Event name");
  if (!event.details.occasion) unknowns.push("Occasion");
  if (!event.details.guests) unknowns.push("Guest count");
  if (!event.details.location) unknowns.push("Location");
  if (!event.details.date) unknowns.push("Date");
  if (!event.details.priceAmount) unknowns.push("Budget");
  // Kitchen only matters if any field is relevant
  if (!event.details.kitchen?.onSitePrep && !event.details.kitchen?.externalKitchen && !event.details.kitchen?.transportRequired) {
    unknowns.push("Kitchen setup");
  }

  // Calculate revenue for verdict
  const calculateRevenue = () => {
    if (!event.details.priceAmount) return undefined;
    if (event.details.pricingModel === "per_head" && event.details.guests) {
      return event.details.priceAmount * event.details.guests;
    }
    return event.details.priceAmount;
  };

  // Get high risks for verdict
  const highRisks = event.risks.filter((r) => r.severity === "high");

  // Calculate prep time estimate from menu
  const prepTimeEstimate = event.menu.courses.reduce((sum, c) => {
    return sum + c.recipeIds.length * 30; // 30 min per recipe as rough estimate
  }, 0) / 60; // in hours

  return (
    <div className="h-full flex flex-col bg-[#FAF8F4]">
      {/* Planning canvas top bar (no back navigation, no editable event header) */}
      <div className="flex items-center justify-end gap-3 px-6 py-3 border-b border-[#E0D4BF] bg-[#FBF4E8]">
        {isDraft && onSave && (
          <button
            onClick={onSave}
            className="px-3 py-1.5 text-xs rounded-md bg-[#2F2A25] text-white hover:bg-[#4A331D] transition"
          >
            Save Event
          </button>
        )}
        <span className="text-xs text-[#8B7E6A]">Autosaved</span>
      </div>

      {/* Phase tabs */}
      <div className="flex gap-1 px-6 py-2 border-b border-[#E0D4BF] bg-[#FBF4E8] overflow-x-auto">
        {PHASE_ORDER.map((phase, idx) => {
          const isActive = currentPhase === phase;
          const isPast = PHASE_ORDER.indexOf(currentPhase) > idx;
          // Allow free navigation: can access any past phase, current phase, or next phase
          const canAccess = isPast || isActive || PHASE_ORDER.indexOf(phase) <= PHASE_ORDER.indexOf(currentPhase) + 1;
          
          return (
            <button
              key={phase}
              onClick={() => canAccess && goToPhase(phase)}
              disabled={!canAccess}
              className={`px-4 py-2 text-sm rounded-lg transition whitespace-nowrap ${
                isActive
                  ? "bg-[#2F2A25] text-white"
                  : isPast
                  ? "bg-[#E8DFD0] text-[#4A331D] hover:bg-[#DED4C3]"
                  : canAccess
                  ? "text-[#8B7E6A] hover:bg-[#E8DFD0] hover:text-[#4A331D]"
                  : "text-[#C5B8A5] cursor-not-allowed"
              }`}
            >
              {PHASE_LABELS[phase]}
            </button>
          );
        })}
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* ════════════════════════════════════════════════════════════════════
            NOTES - Free-form thinking space
        ════════════════════════════════════════════════════════════════════ */}
        {currentPhase === "idea" && (
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-auto p-10">
              <div className="max-w-3xl mx-auto h-full flex flex-col gap-4">
                <textarea
                  ref={textareaRef}
                  value={localNotes}
                  onChange={(e) => setLocalNotes(e.target.value)}
                  placeholder="Jot down what you know about this event…

Paste an email, forward a WhatsApp brief, or just type quick notes:

• 18 guests, dinner in Weligama, Feb 12
• Budget around 350k
• One guest is gluten-free
• They want family-style seafood

Don't worry about formatting — drop a file below to extract the details."
                  className="flex-1 w-full resize-none bg-[#FBF4E8] border border-[#E0D4BF] rounded-xl p-4 text-[#2F2A25] text-[15px] leading-relaxed focus:outline-none focus:border-[#C5B8A5] placeholder:text-[#8B7E6A]"
                  style={{ minHeight: "320px" }}
                />
                <div className="text-xs text-[#8B7E6A]">
                  Your notes stay here for reference. Upload a brief to auto-fill the Event Brief.
                </div>

                {/* Existing event brief upload/dropzone UI (reused; no logic duplication) */}
                <div
                  className={`border border-[#E0D4BF] rounded-xl p-4 transition-colors ${
                    isDragging ? "bg-[#E8DFD0]" : "bg-[#FBF4E8]"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {/* Attachments count */}
                  {attachedFiles.length > 0 && (
                    <div className="mb-3 text-xs text-[#8B7E6A]">
                      {attachedFiles.length} attachment{attachedFiles.length === 1 ? "" : "s"} added
                    </div>
                  )}

                  <div className="flex items-center justify-center">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-[#8B7E6A] hover:text-[#4A331D] hover:bg-[#E8DFD0] rounded-lg transition"
                    >
                      <span>📎</span>
                      <span>Drop a brief, screenshot, or PDF here</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf,.txt,.md"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            EVENT BRIEF — Structured event details
        ════════════════════════════════════════════════════════════════════ */}
        {currentPhase === "clarify" && (
          <div className="flex-1 overflow-auto bg-[#FAF8F4]">
            <section className="max-w-4xl mx-auto px-8 pt-20 pb-16">

              {/* EVENT TITLE */}
              <h1
                className="text-5xl font-bold leading-[1.1] tracking-tight text-[#1A1A1A] outline-none cursor-text transition mb-4"
                style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => {
                  const newName = e.currentTarget.innerText.trim();
                  if (newName && newName !== event.name) {
                    onUpdate({ name: newName });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
              >
                {event.name && event.name !== "New Event" ? event.name : "Untitled Event"}
              </h1>

              {/* QUICK SUMMARY */}
              <p className="text-xl text-[#6F6352] leading-relaxed mb-10" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                {[
                  event.details.occasion,
                  event.details.date,
                  event.details.location,
                  event.details.guests && `${event.details.guests} guests`,
                ].filter(Boolean).join(" · ") || "Upload a brief to auto-fill these details"}
              </p>

              {/* DIVIDER */}
              <div className="w-full h-px bg-[#D4C9B8] mb-10" />

              {/* ═══ SECTION: Basic Details ═══ */}
              <div className="mb-6">
                <h2 className="text-xs uppercase tracking-widest text-[#8B7E6A] mb-3 font-semibold">Event Details</h2>
                <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-lg" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                  <div><span className="text-[#8B7E6A]">Occasion:</span> <span contentEditable suppressContentEditableWarning className="outline-none cursor-text" onBlur={(e) => updateDetails({ occasion: e.currentTarget.innerText.trim() || undefined })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}>{event.details.occasion || "—"}</span></div>
                  <div><span className="text-[#8B7E6A]">Date:</span> <span contentEditable suppressContentEditableWarning className="outline-none cursor-text" onBlur={(e) => updateDetails({ date: e.currentTarget.innerText.trim() || undefined })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}>{event.details.date || "—"}</span></div>
                  <div><span className="text-[#8B7E6A]">Location:</span> <span contentEditable suppressContentEditableWarning className="outline-none cursor-text" onBlur={(e) => updateDetails({ location: e.currentTarget.innerText.trim() || undefined })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}>{event.details.location || "—"}</span></div>
                  <div><span className="text-[#8B7E6A]">Guests:</span> <span contentEditable suppressContentEditableWarning className="outline-none cursor-text" onBlur={(e) => { const n = parseInt(e.currentTarget.innerText.replace(/[^0-9]/g, ""), 10); updateDetails({ guests: isNaN(n) ? undefined : n }); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}>{event.details.guests || "—"}</span></div>
                </div>
              </div>

              {/* ═══ SECTION: Timing ═══ */}
              <div className="mb-6">
                <h2 className="text-xs uppercase tracking-widest text-[#8B7E6A] mb-3 font-semibold">Timing</h2>
                <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-lg" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                  <div><span className="text-[#8B7E6A]">Service Start:</span> <span contentEditable suppressContentEditableWarning className="outline-none cursor-text" onBlur={(e) => updateDetails({ serviceStart: e.currentTarget.innerText.trim() || undefined })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}>{event.details.serviceStart || "—"}</span></div>
                  <div><span className="text-[#8B7E6A]">Service End:</span> <span contentEditable suppressContentEditableWarning className="outline-none cursor-text" onBlur={(e) => updateDetails({ serviceEnd: e.currentTarget.innerText.trim() || undefined })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}>{event.details.serviceEnd || "—"}</span></div>
                  <div><span className="text-[#8B7E6A]">Duration:</span> {event.details.multiDay ? `Multi-day (${event.details.numberOfDays || "?"} days)` : "Single day"}</div>
                </div>
              </div>

              {/* ═══ SECTION: Service & Style ═══ */}
              <div className="mb-6">
                <h2 className="text-xs uppercase tracking-widest text-[#8B7E6A] mb-3 font-semibold">Service & Style</h2>
                <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-lg" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                  <div><span className="text-[#8B7E6A]">Menu Style:</span> {event.details.menuStyle === "course_meal" ? "Course Meal" : event.details.menuStyle === "buffet" ? "Buffet" : event.details.menuStyle === "street_food" ? "Street Food" : "—"}</div>
                  <div><span className="text-[#8B7E6A]">Seating:</span> {event.details.seatingStyle || "—"}</div>
                  <div><span className="text-[#8B7E6A]">Dietary:</span> {event.details.dietaryRequirements?.join(", ") || "—"}</div>
                  <div><span className="text-[#8B7E6A]">Staff:</span> {event.details.staffCount ? `${event.details.staffCount} people` : "—"}</div>
                  {event.details.kitchen && (
                    <>
                      <div><span className="text-[#8B7E6A]">On-site Prep:</span> {event.details.kitchen.onSitePrep ? "Yes" : "No"}</div>
                      <div><span className="text-[#8B7E6A]">External Kitchen:</span> {event.details.kitchen.externalKitchen ? "Yes" : "No"}</div>
                      <div><span className="text-[#8B7E6A]">Transport Required:</span> {event.details.kitchen.transportRequired ? "Yes" : "No"}</div>
                    </>
                  )}
                </div>
              </div>

              {/* ═══ SECTION: Budget ═══ */}
              <div className="mb-6">
                <h2 className="text-xs uppercase tracking-widest text-[#8B7E6A] mb-3 font-semibold">Budget</h2>
                <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-lg" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                  <div><span className="text-[#8B7E6A]">Amount:</span> {event.details.priceAmount ? `${event.details.currency || "LKR"} ${event.details.priceAmount.toLocaleString()}` : "—"}</div>
                  <div><span className="text-[#8B7E6A]">Pricing Model:</span> {event.details.pricingModel === "per_head" ? "Per Head" : event.details.pricingModel === "event_total" ? "Event Total" : "—"}</div>
                </div>
              </div>

              {/* ═══ SECTION: Notes ═══ */}
              {event.freeformNotes && event.freeformNotes.trim() && (
                <div className="mb-6">
                  <h2 className="text-xs uppercase tracking-widest text-[#8B7E6A] mb-2 font-semibold">Notes</h2>
                  <p className="text-lg leading-relaxed text-[#2F2A25] whitespace-pre-wrap" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                    {event.freeformNotes}
                  </p>
                </div>
              )}

              {/* ═══ SECTION: Constraints ═══ */}
              {event.constraints && event.constraints.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-xs uppercase tracking-widest text-[#8B7E6A] mb-2 font-semibold">Constraints</h2>
                  <ul className="space-y-2 text-lg text-[#2F2A25]" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                    {event.constraints.map((c, i) => <li key={i}>• {c}</li>)}
                  </ul>
                </div>
              )}

              {/* ═══ SECTION: To Confirm ═══ */}
              {unknowns.length > 0 && (
                <div className="mb-6 p-4 bg-[#FFF7E8] rounded-lg border border-[#F2D6A2]">
                  <h2 className="text-xs uppercase tracking-widest text-[#8A5A00] mb-2 font-semibold">To Confirm</h2>
                  <ul className="space-y-1 text-sm text-[#6F6352]">
                    {unknowns.map((item, i) => <li key={i}>• {item}</li>)}
                  </ul>
                </div>
              )}

              {/* ═══ SOURCE TEXT TOGGLE ═══ */}
              {event.extractedText && event.extractedText.trim() && (
                <div className="mb-6">
                  <button
                    onClick={() => setShowSourceText(!showSourceText)}
                    className="text-xs text-[#8B7E6A] hover:text-[#4A331D] underline"
                  >
                    {showSourceText ? "Hide source text" : "Show source text"}
                  </button>
                  {showSourceText && (
                    <div className="mt-3 p-4 bg-[#F5F2ED] rounded-lg text-sm text-[#6F6352] whitespace-pre-wrap max-h-48 overflow-y-auto" style={{ fontFamily: "monospace" }}>
                      {event.extractedText}
                    </div>
                  )}
                </div>
              )}

              {/* ACTION BUTTON — Dark, visible */}
              <div className="pt-6 border-t border-[#D4C9B8]">
                <button
                  onClick={() => goToPhase("menu")}
                  className="px-8 py-4 bg-[#2F2A25] text-white text-lg rounded-lg hover:bg-[#1A1A1A] transition font-medium shadow-sm"
                >
                  Continue to Menu Design →
                </button>
              </div>

            </section>
          </div>
        )}

        {/* Debug: Raw OCR text not rendered. event.extractedText is stored but hidden. */}

        {/* ════════════════════════════════════════════════════════════════════
            MENU DESIGN
        ════════════════════════════════════════════════════════════════════ */}
        {currentPhase === "menu" && (
          <div className="flex-1 overflow-hidden">
            <MenuDesign
              menu={event.menu}
              recipes={recipes}
              guestCount={event.details.guests || 0}
              menuStyle={event.details.menuStyle}
              multiDay={event.details.multiDay}
              numberOfDays={event.details.numberOfDays}
              onUpdate={(menu) => onUpdate({ menu })}
              onCreateRecipe={() => {
                // In a full implementation, this would open a recipe creation modal
                alert("Recipe creation would open here");
              }}
              onContinue={() => goToPhase("cost")}
              eventLocation={event.details.location}
              eventDate={event.details.date}
              eventOccasion={event.details.occasion}
              eventConstraints={event.constraints}
              dietaryRequirements={event.details.dietaryRequirements}
              shoppingList={event.shoppingList || []}
            />
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            EXECUTION PLAN — Operations & timeline
        ════════════════════════════════════════════════════════════════════ */}
        {currentPhase === "cost" && (
          <div className="flex-1 overflow-hidden">
            <CostOperations
              costBreakdown={event.costBreakdown}
              operations={event.operations}
              currency={event.details.currency || "LKR"}
              guestCount={event.details.guests || 0}
              invoices={invoices}
              onUpdateCost={(cost) => onUpdate({ costBreakdown: cost })}
              onUpdateOperations={(ops) => onUpdate({ operations: ops })}
              customerBudget={event.details.budget}
              recipes={event.menu.courses.flatMap((c) =>
                c.recipeIds.map((id) => {
                  const r = recipes.find((rec) => rec.id === id);
                  return r ? { 
                    id: r.id, 
                    name: r.name, 
                    prepTime: r.prepTime, 
                    course: c.type,
                    servings: r.servings,
                    ingredients: r.ingredients,
                  } : null;
                }).filter(Boolean) as { 
                  id: string; 
                  name: string; 
                  prepTime?: number; 
                  course?: string;
                  servings?: number;
                  ingredients?: Array<{ name: string; quantity: number | null; unit: string | null; category?: "fresh" | "dry" | "other" }>;
                }[]
              )}
              eventDate={event.details.date}
              serviceStart={event.details.serviceStart}
              serviceEnd={event.details.serviceEnd}
              eventLocation={event.details.location}
              eventOccasion={event.details.occasion}
              menuStyle={event.details.menuStyle}
              kitchen={event.details.kitchen}
              shoppingList={event.shoppingList || []}
            />
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            DECISION — Go / No-go verdict
        ════════════════════════════════════════════════════════════════════ */}
        {currentPhase === "verdict" && (() => {
          // Calculate cost completeness for verdict
          const ingredients = event.costBreakdown?.ingredients || [];
          const unpricedCount = ingredients.filter(
            (i) => i.source === "unknown" || i.priceUnknown
          ).length;
          const costComplete = unpricedCount === 0 && ingredients.length > 0;
          
          return (
            <div className="flex-1 overflow-hidden">
              <VerdictPage
                eventName={event.name}
                details={event.details}
                totalCost={event.costBreakdown?.total}
                revenue={calculateRevenue()}
                highRisks={highRisks}
                unknowns={event.unknowns}
                constraints={event.constraints}
                menuRecipeCount={event.menu.courses.reduce((sum, c) => sum + c.recipeIds.length, 0)}
                currentVerdict={event.verdict}
                verdictNotes={event.verdictNotes}
                costComplete={costComplete}
                unpricedIngredientCount={unpricedCount}
                onVerdict={(verdict, notes) => {
                  onUpdate({ 
                    verdict, 
                    verdictNotes: notes,
                    verdictDate: Date.now()
                  });
                  if (verdict === "proceed") {
                    goToPhase("report");
                  }
                }}
                onGoBack={(phase) => goToPhase(phase as EventProjectPhase)}
              />
            </div>
          );
        })()}

        {/* ════════════════════════════════════════════════════════════════════
            CLIENT OUTPUT — Final report & deliverables
        ════════════════════════════════════════════════════════════════════ */}
        {currentPhase === "report" && (
          <div className="flex-1 overflow-hidden">
            <EventReport
              eventName={event.name}
              details={event.details}
              menu={event.menu}
              recipes={recipes}
              costBreakdown={event.costBreakdown}
              operations={event.operations}
              risks={event.risks}
              verdict={event.verdict}
              verdictNotes={event.verdictNotes}
              verdictDate={event.verdictDate}
              viewMode="chef"
              invoices={event.invoices || []}
              onUploadInvoice={onUploadReportInvoice}
              onRemoveInvoice={onRemoveReportInvoice}
            />
          </div>
        )}

      </div>
    </div>
  );
}

export type { EventProject, EventProjectPhase, EventDetails, EventMenu, EventCostBreakdown, EventRisk, EventVerdict, EventInvoice };
