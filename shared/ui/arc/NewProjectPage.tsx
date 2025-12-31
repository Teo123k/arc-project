"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MenuDesign } from "./MenuDesign";
import { CostOperations } from "./CostOperations";
import { RiskAssessment } from "./RiskAssessment";
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
  | "risk"
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

type EventCostItem = {
  ingredientName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  source: "invoice" | "market_avg" | "manual";
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
  costBreakdown: EventCostBreakdown | null;
  operations: EventOperationsTimeline | null;
  risks: EventRisk[];
  verdict: EventVerdict;
  verdictNotes?: string;
  verdictDate?: number;
  folderId?: string | null;
};

type UploadedFile = {
  id: string;
  name: string;
  extractedText?: string | null;
};

type Recipe = {
  id: string;
  name: string;
  cuisine?: string;
  category?: string;
  prepTime?: number;
  dietary?: string[];
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
  onUpload: (files: FileList) => Promise<string[]>;
  uploadedFiles: UploadedFile[];
  recipes?: Recipe[];
  invoices?: Invoice[];
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

const PHASE_LABELS: Record<EventProjectPhase, string> = {
  idea: "Idea",
  clarify: "Clarify",
  menu: "Menu",
  cost: "Cost",
  risk: "Risk",
  verdict: "Verdict",
  report: "Report",
};

const PHASE_ORDER: EventProjectPhase[] = ["idea", "clarify", "menu", "cost", "risk", "verdict", "report"];

export function NewProjectPage({
  event,
  onUpdate,
  onClose,
  onUpload,
  uploadedFiles,
  recipes = [],
  invoices = [],
}: NewProjectPageProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localNotes, setLocalNotes] = useState(event.freeformNotes);
  const [showDetails, setShowDetails] = useState(
    !!(event.details.occasion || event.details.guests || event.details.location)
  );
  const [isDragging, setIsDragging] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<EventProjectPhase>(event.phase);

  // Focus textarea on mount for idea phase
  useEffect(() => {
    if (textareaRef.current && currentPhase === "idea") {
      textareaRef.current.focus();
    }
  }, [currentPhase]);

  // Detect when to show details panel (progressive reveal)
  useEffect(() => {
    const hasFiles = event.uploadedFileIds.length > 0;
    const hasAnyText = localNotes.trim().length > 0;

    // One-time Idea input: advance as soon as the user provides any text or any attachment.
    if (hasAnyText || hasFiles) {
      setShowDetails(true);
    }
  }, [localNotes, event.uploadedFileIds]);

  // Debounced save for notes
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (localNotes !== event.freeformNotes) {
        onUpdate({ freeformNotes: localNotes });
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [localNotes, event.freeformNotes, onUpdate]);

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
    }
  }, [onUpload, onUpdate, event.uploadedFileIds]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newIds = await onUpload(e.target.files);
      onUpdate({ uploadedFileIds: [...event.uploadedFileIds, ...newIds] });
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

  // Detect unknowns from context
  const unknowns: string[] = [];
  if (!event.details.priceAmount) unknowns.push("Budget not confirmed — waiting on client");
  if (!event.details.kitchen?.onSitePrep && !event.details.kitchen?.externalKitchen) {
    unknowns.push("Kitchen access hours unclear");
  }
  if (event.menu.courses.length === 0) unknowns.push("Menu not yet designed");

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
      <div className="flex items-center justify-end px-6 py-3 border-b border-[#E0D4BF] bg-[#FBF4E8]">
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
            IDEA PHASE - Free-form thinking space
        ════════════════════════════════════════════════════════════════════ */}
        {currentPhase === "idea" && (
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-auto p-10">
              <div className="max-w-3xl mx-auto h-full flex flex-col">
                {!localNotes && (
                  <h2 className="text-3xl font-light text-[#8B7E6A] mb-4 select-none pointer-events-none">
                    What’s the idea of the project?
                  </h2>
                )}
                {!showDetails && (
                  <textarea
                    ref={textareaRef}
                    value={localNotes}
                    onChange={(e) => setLocalNotes(e.target.value)}
                    placeholder="What’s the idea of the project?"
                    className="flex-1 w-full resize-none bg-transparent text-[#2F2A25] text-lg leading-relaxed focus:outline-none placeholder:text-[#C5B8A5]"
                    style={{ minHeight: "300px" }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            CLARIFY PHASE - Unknowns and constraints
        ════════════════════════════════════════════════════════════════════ */}
        {currentPhase === "clarify" && (
          <div className="flex-1 overflow-auto">
            <div className="p-10">
              <div className="max-w-5xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-[1.2fr,0.8fr] gap-10">
                  {/* Left: Structured event details (primary) */}
                  <div>
                    <div className="mb-4">
                      <h2 className="text-lg font-semibold text-[#2F2A25]">Event details</h2>
                      <p className="text-sm text-[#8B7E6A] mt-1">
                        This is the event shell. The idea notes won&apos;t re-open for editing after this step.
                      </p>
                    </div>

                    <div className="bg-white border border-[#E0D4BF] rounded-xl p-6 space-y-5">
                      {/* Occasion */}
                      <div>
                        <label className="text-[11px] text-[#8B7E6A] uppercase tracking-wider">
                          Occasion
                        </label>
                        <select
                          value={event.details.occasion || ""}
                          onChange={(e) => updateDetails({ occasion: e.target.value })}
                          className="mt-1 w-full px-3 py-2 bg-white border border-[#E0D4BF] rounded-lg text-sm text-[#2F2A25] focus:outline-none focus:border-[#C5B8A5]"
                        >
                          <option value="">Select occasion...</option>
                          {OCCASION_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Guests */}
                        <div>
                          <label className="text-[11px] text-[#8B7E6A] uppercase tracking-wider">
                            Guests
                          </label>
                          <input
                            type="number"
                            value={event.details.guests || ""}
                            onChange={(e) => updateDetails({ guests: parseInt(e.target.value) || undefined })}
                            placeholder="e.g., 40"
                            className="mt-1 w-full px-3 py-2 bg-white border border-[#E0D4BF] rounded-lg text-sm text-[#2F2A25] focus:outline-none focus:border-[#C5B8A5]"
                          />
                        </div>

                        {/* Date */}
                        <div>
                          <label className="text-[11px] text-[#8B7E6A] uppercase tracking-wider">
                            Date
                          </label>
                          <input
                            type="date"
                            value={event.details.date || ""}
                            onChange={(e) => updateDetails({ date: e.target.value })}
                            className="mt-1 w-full px-3 py-2 bg-white border border-[#E0D4BF] rounded-lg text-sm text-[#2F2A25] focus:outline-none focus:border-[#C5B8A5]"
                          />
                        </div>
                      </div>

                      {/* Location */}
                      <div>
                        <label className="text-[11px] text-[#8B7E6A] uppercase tracking-wider">
                          Location
                        </label>
                        <input
                          type="text"
                          value={event.details.location || ""}
                          onChange={(e) => updateDetails({ location: e.target.value })}
                          placeholder="e.g., Private garden, Weligama"
                          className="mt-1 w-full px-3 py-2 bg-white border border-[#E0D4BF] rounded-lg text-sm text-[#2F2A25] focus:outline-none focus:border-[#C5B8A5]"
                        />
                      </div>

                      {/* Pricing Model */}
                      <div>
                        <label className="text-[11px] text-[#8B7E6A] uppercase tracking-wider">
                          Pricing model
                        </label>
                        <div className="mt-2 flex gap-5">
                          <label className="flex items-center gap-2 text-sm text-[#4A331D] cursor-pointer">
                            <input
                              type="radio"
                              name="pricingModel"
                              checked={event.details.pricingModel === "per_head"}
                              onChange={() => updateDetails({ pricingModel: "per_head" })}
                              className="text-[#4A331D]"
                            />
                            Per head
                          </label>
                          <label className="flex items-center gap-2 text-sm text-[#4A331D] cursor-pointer">
                            <input
                              type="radio"
                              name="pricingModel"
                              checked={event.details.pricingModel === "event_total"}
                              onChange={() => updateDetails({ pricingModel: "event_total" })}
                              className="text-[#4A331D]"
                            />
                            Event total
                          </label>
                        </div>

                        {event.details.pricingModel && (
                          <div className="mt-2 grid grid-cols-[110px,1fr] gap-2">
                            <select
                              value={event.details.currency || "LKR"}
                              onChange={(e) => updateDetails({ currency: e.target.value })}
                              className="px-2 py-2 bg-white border border-[#E0D4BF] rounded-lg text-sm text-[#2F2A25] focus:outline-none"
                            >
                              <option value="LKR">LKR</option>
                              <option value="USD">USD</option>
                              <option value="EUR">EUR</option>
                              <option value="GBP">GBP</option>
                            </select>
                            <input
                              type="number"
                              value={event.details.priceAmount || ""}
                              onChange={(e) => updateDetails({ priceAmount: parseFloat(e.target.value) || undefined })}
                              placeholder={event.details.pricingModel === "per_head" ? "Price per head" : "Total price"}
                              className="px-3 py-2 bg-white border border-[#E0D4BF] rounded-lg text-sm text-[#2F2A25] focus:outline-none focus:border-[#C5B8A5]"
                            />
                          </div>
                        )}
                      </div>

                      {/* Kitchen Situation */}
                      <div>
                        <label className="text-[11px] text-[#8B7E6A] uppercase tracking-wider">
                          Kitchen situation
                        </label>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <label className="flex items-center gap-2 text-sm text-[#4A331D] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={event.details.kitchen?.onSitePrep || false}
                              onChange={(e) =>
                                updateDetails({
                                  kitchen: { ...event.details.kitchen, onSitePrep: e.target.checked } as EventKitchenSituation,
                                })
                              }
                              className="rounded text-[#4A331D]"
                            />
                            On-site prep
                          </label>
                          <label className="flex items-center gap-2 text-sm text-[#4A331D] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={event.details.kitchen?.externalKitchen || false}
                              onChange={(e) =>
                                updateDetails({
                                  kitchen: { ...event.details.kitchen, externalKitchen: e.target.checked } as EventKitchenSituation,
                                })
                              }
                              className="rounded text-[#4A331D]"
                            />
                            External kitchen
                          </label>
                          <label className="flex items-center gap-2 text-sm text-[#4A331D] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={event.details.kitchen?.transportRequired || false}
                              onChange={(e) =>
                                updateDetails({
                                  kitchen: { ...event.details.kitchen, transportRequired: e.target.checked } as EventKitchenSituation,
                                })
                              }
                              className="rounded text-[#4A331D]"
                            />
                            Transport required
                          </label>
                        </div>
                      </div>

                      {/* Multi-day Event */}
                      <div>
                        <label className="text-[11px] text-[#8B7E6A] uppercase tracking-wider">
                          Event duration
                        </label>
                        <div className="mt-2 flex items-center gap-4">
                          <label className="flex items-center gap-2 text-sm text-[#4A331D] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={event.details.multiDay || false}
                              onChange={(e) => updateDetails({ 
                                multiDay: e.target.checked,
                                numberOfDays: e.target.checked ? (event.details.numberOfDays || 2) : undefined
                              })}
                              className="rounded text-[#4A331D]"
                            />
                            Multi-day event
                          </label>
                          {event.details.multiDay && (
                            <input
                              type="number"
                              min="2"
                              max="30"
                              value={event.details.numberOfDays || 2}
                              onChange={(e) => updateDetails({ numberOfDays: parseInt(e.target.value) || 2 })}
                              className="w-20 px-3 py-1.5 bg-white border border-[#E0D4BF] rounded-lg text-sm text-[#2F2A25] focus:outline-none focus:border-[#C5B8A5]"
                            />
                          )}
                          {event.details.multiDay && (
                            <span className="text-sm text-[#8B7E6A]">days</span>
                          )}
                        </div>
                      </div>

                      {/* Menu Style */}
                      <div>
                        <label className="text-[11px] text-[#8B7E6A] uppercase tracking-wider">
                          Service style
                        </label>
                        <div className="mt-2 flex flex-wrap gap-3">
                          <label className="flex items-center gap-2 text-sm text-[#4A331D] cursor-pointer">
                            <input
                              type="radio"
                              name="menuStyle"
                              checked={event.details.menuStyle === "course_meal"}
                              onChange={() => updateDetails({ menuStyle: "course_meal" })}
                              className="text-[#4A331D]"
                            />
                            Course meal
                          </label>
                          <label className="flex items-center gap-2 text-sm text-[#4A331D] cursor-pointer">
                            <input
                              type="radio"
                              name="menuStyle"
                              checked={event.details.menuStyle === "buffet"}
                              onChange={() => updateDetails({ menuStyle: "buffet" })}
                              className="text-[#4A331D]"
                            />
                            Buffet
                          </label>
                          <label className="flex items-center gap-2 text-sm text-[#4A331D] cursor-pointer">
                            <input
                              type="radio"
                              name="menuStyle"
                              checked={event.details.menuStyle === "street_food"}
                              onChange={() => updateDetails({ menuStyle: "street_food" })}
                              className="text-[#4A331D]"
                            />
                            Street food (1-3 dishes)
                          </label>
                        </div>
                      </div>

                      {/* Dietary Requirements */}
                      <div>
                        <label className="text-[11px] text-[#8B7E6A] uppercase tracking-wider">
                          Dietary requirements
                        </label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {["Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Nut-free", "Halal", "Kosher"].map((diet) => {
                            const isSelected = event.details.dietaryRequirements?.includes(diet.toLowerCase());
                            return (
                              <button
                                key={diet}
                                onClick={() => {
                                  const current = event.details.dietaryRequirements || [];
                                  const lower = diet.toLowerCase();
                                  if (isSelected) {
                                    updateDetails({ dietaryRequirements: current.filter((d) => d !== lower) });
                                  } else {
                                    updateDetails({ dietaryRequirements: [...current, lower] });
                                  }
                                }}
                                className={`px-3 py-1.5 text-xs rounded-full border transition ${
                                  isSelected
                                    ? "bg-[#2F2A25] text-white border-[#2F2A25]"
                                    : "bg-white text-[#4A331D] border-[#E0D4BF] hover:border-[#C5B8A5]"
                                }`}
                              >
                                {diet}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => goToPhase("menu")}
                      className="mt-6 w-full px-4 py-3 bg-[#2F2A25] text-white rounded-lg hover:bg-[#4A331D] transition"
                    >
                      Continue to Menu →
                    </button>
                  </div>

                  {/* Right: Chef notes + background */}
                  <div className="space-y-4">
                    <div className="bg-[#FBF4E8] border border-[#E0D4BF] rounded-xl p-5">
                      <div className="text-[11px] uppercase tracking-wider text-[#8B7E6A] mb-2">
                        Chef notes
                      </div>

                      {/* Unknowns */}
                      {unknowns.length > 0 ? (
                        <div className="space-y-2">
                          {unknowns.map((u, idx) => (
                            <div key={idx} className="text-sm text-[#4A331D]">
                              • {u}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-[#8B7E6A]">
                          No major unknowns flagged yet.
                        </div>
                      )}
                    </div>

                    <div className="bg-[#FBF4E8] border border-[#E0D4BF] rounded-xl p-5">
                      <div className="text-[11px] uppercase tracking-wider text-[#8B7E6A] mb-2">
                        Constraints (from details)
                      </div>
                      <div className="space-y-2 text-sm text-[#4A331D]">
                        {event.details.guests && event.details.kitchen?.onSitePrep && (
                          <div>• {event.details.guests} guests with on-site prep → confirm access time</div>
                        )}
                        {event.details.kitchen?.transportRequired && (
                          <div>• Transport required → hot holding and food safety plan</div>
                        )}
                        {event.details.guests && event.details.guests > 50 && (
                          <div>• Large event ({event.details.guests}) → consider additional staff</div>
                        )}
                        {!event.details.guests &&
                          !event.details.kitchen?.transportRequired &&
                          !event.details.kitchen?.onSitePrep && (
                            <div className="text-[#8B7E6A]">Fill in details to surface constraints.</div>
                          )}
                      </div>
                    </div>

                    <details className="bg-white border border-[#E0D4BF] rounded-xl p-5">
                      <summary className="cursor-pointer text-sm font-medium text-[#4A331D]">
                        Background notes
                      </summary>
                      <div className="mt-3 text-sm text-[#4A331D] whitespace-pre-wrap">
                        {event.freeformNotes || "(No notes yet)"}
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            MENU PHASE
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
            />
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            COST PHASE
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
            />
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            RISK PHASE
        ════════════════════════════════════════════════════════════════════ */}
        {currentPhase === "risk" && (
          <div className="flex-1 overflow-hidden">
            <RiskAssessment
              risks={event.risks}
              onUpdate={(risks) => onUpdate({ risks })}
              guestCount={event.details.guests}
              prepTimeHours={prepTimeEstimate}
              hasTransport={event.details.kitchen?.transportRequired}
              budgetMargin={
                event.costBreakdown?.total && calculateRevenue()
                  ? Math.round(((calculateRevenue()! - event.costBreakdown.total) / calculateRevenue()!) * 100)
                  : undefined
              }
            />
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            VERDICT PHASE
        ════════════════════════════════════════════════════════════════════ */}
        {currentPhase === "verdict" && (
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
        )}

        {/* ════════════════════════════════════════════════════════════════════
            REPORT PHASE
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
              onExport={(format) => {
                // In a full implementation, this would trigger actual export
                alert(`Exporting as ${format}...`);
              }}
            />
          </div>
        )}

        {/* Bottom: File upload zone (only for idea phase) */}
        {currentPhase === "idea" && (
          <div
            className={`border-t border-[#E0D4BF] p-4 transition-colors ${
              isDragging ? "bg-[#E8DFD0]" : "bg-[#FBF4E8]"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="max-w-2xl mx-auto">
              {/* Attachments (no file log UI) */}
              {attachedFiles.length > 0 && (
                <div className="mb-3 text-xs text-[#8B7E6A]">
                  {attachedFiles.length} attachment{attachedFiles.length === 1 ? "" : "s"} added
                </div>
              )}

              {/* Upload button */}
              <div className="flex items-center justify-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-[#8B7E6A] hover:text-[#4A331D] hover:bg-[#E8DFD0] rounded-lg transition"
                >
                  <span>+</span>
                  <span>Drop files, screenshots, or images here</span>
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
        )}
      </div>
    </div>
  );
}

export type { EventProject, EventProjectPhase, EventDetails, EventMenu, EventCostBreakdown, EventRisk, EventVerdict };
