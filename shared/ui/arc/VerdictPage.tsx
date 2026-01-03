"use client";

import { useState, useCallback } from "react";

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

type EventVerdict = "proceed" | "adjust" | "decline" | null;

type EventDetails = {
  occasion?: string;
  guests?: number;
  location?: string;
  priceAmount?: number;
  currency?: string;
  date?: string;
};

type EventRisk = {
  severity: "high" | "medium" | "low" | "ok";
  description: string;
};

type AIRecommendation = {
  verdict: EventVerdict;
  confidence: number;
  summary: string;
  reasoning: string[];
  improvements: string[];
  warnings: string[];
  profitabilityAssessment: string;
};

interface VerdictPageProps {
  eventName: string;
  details: EventDetails;
  totalCost?: number;
  revenue?: number;
  highRisks: EventRisk[];
  unknowns?: string[];
  constraints?: string[];
  menuRecipeCount?: number;
  currentVerdict: EventVerdict;
  verdictNotes?: string;
  onVerdict: (verdict: EventVerdict, notes?: string) => void;
  onGoBack: (phase: string) => void;
  // Invoice status
  costComplete?: boolean; // true = all ingredients invoice-backed
  unpricedIngredientCount?: number;
}

// ────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ────────────────────────────────────────────────────────────────────────────

export function VerdictPage({
  eventName,
  details,
  totalCost,
  revenue,
  highRisks,
  unknowns = [],
  constraints = [],
  menuRecipeCount = 0,
  currentVerdict,
  verdictNotes,
  onVerdict,
  onGoBack,
  costComplete = true,
  unpricedIngredientCount = 0,
}: VerdictPageProps) {
  const [notes, setNotes] = useState(verdictNotes || "");
  const [selectedVerdict, setSelectedVerdict] = useState<EventVerdict>(currentVerdict);
  const [aiRecommendation, setAIRecommendation] = useState<AIRecommendation | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // Cost calculations only valid when complete
  const costIsValid = costComplete && totalCost !== undefined;
  const margin = revenue && costIsValid ? revenue - totalCost : null;
  const marginPercent = revenue && costIsValid ? Math.round(((revenue - totalCost) / revenue) * 100) : null;

  const handleConfirm = () => {
    if (selectedVerdict) {
      onVerdict(selectedVerdict, notes);
    }
  };

  // Get AI recommendation
  const getAIRecommendation = useCallback(async () => {
    setLoadingAI(true);
    try {
      const res = await fetch("/api/arc/event-verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: eventName,
          occasion: details.occasion,
          guests: details.guests,
          location: details.location,
          date: details.date,
          budget: details.priceAmount,
          currency: details.currency,
          menuRecipeCount,
          totalCost: totalCost || 0,
          margin: marginPercent,
          highRisks: highRisks.map((r) => r.description),
          unknowns,
          constraints,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setAIRecommendation(data);
        // Auto-select the AI's recommended verdict
        if (data.verdict) {
          setSelectedVerdict(data.verdict);
        }
      }
    } catch (err) {
      console.error("Failed to get AI recommendation:", err);
    } finally {
      setLoadingAI(false);
    }
  }, [eventName, details, totalCost, marginPercent, highRisks, unknowns, constraints, menuRecipeCount]);

  return (
    <div className="h-full flex flex-col bg-[#FAF8F4]">
      {/* Header */}
      <div className="px-6 py-8 border-b border-[#E0D4BF] bg-[#FBF4E8]">
        <h1 className="text-2xl font-bold text-[#2F2A25] mb-2">{eventName}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-[#6F6352]">
          {details.guests && <span>{details.guests} guests</span>}
          {details.priceAmount && (
            <span>
              {details.currency || "LKR"} {details.priceAmount.toLocaleString()}
              {details.guests ? "/head" : ""}
            </span>
          )}
          {details.date && <span>{details.date}</span>}
          {details.location && <span>{details.location}</span>}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Financial summary with provenance */}
          {!costComplete && unpricedIngredientCount > 0 ? (
            <div className="p-5 bg-amber-50/50 border border-amber-200 rounded-lg text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-xl">🔒</span>
                <span className="text-amber-800 font-medium">
                  Financial summary incomplete — awaiting invoices.
                </span>
              </div>
              <p className="text-sm text-amber-700">
                {unpricedIngredientCount} ingredient{unpricedIngredientCount > 1 ? "s" : ""} awaiting invoice
              </p>
            </div>
          ) : (totalCost || revenue) && (
            <div className="grid grid-cols-3 gap-4">
              {revenue && (
                <div className="p-4 bg-white border border-[#E0D4BF] rounded-lg text-center">
                  <div className="text-xs text-[#8B7E6A] uppercase tracking-wider mb-1">Revenue</div>
                  <div className="text-lg font-bold text-[#2F2A25]">
                    {details.currency || "LKR"} {revenue.toLocaleString()}
                  </div>
                  <div className="text-xs text-[#A89D8A]">From event brief</div>
                </div>
              )}
              {costIsValid && (
                <div className="p-4 bg-white border border-[#E0D4BF] rounded-lg text-center">
                  <div className="text-xs text-[#8B7E6A] uppercase tracking-wider mb-1">Cost</div>
                  <div className="text-lg font-bold text-[#2F2A25]">
                    {details.currency || "LKR"} {totalCost.toLocaleString()}
                  </div>
                  <div className="text-xs text-green-600">✓ Invoice-backed</div>
                </div>
              )}
              {margin !== null && marginPercent !== null && (
                <div className="p-4 bg-white border border-[#E0D4BF] rounded-lg text-center">
                  <div className="text-xs text-[#8B7E6A] uppercase tracking-wider mb-1">Margin</div>
                  <div className="text-lg font-bold text-[#2F2A25]">
                    {marginPercent}%
                  </div>
                  <div className="text-xs text-[#A89D8A]">Revenue − Cost</div>
                </div>
              )}
            </div>
          )}

          {/* High risks warning */}
          {highRisks.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-amber-600 font-bold">•</span>
                <span className="text-sm font-semibold text-amber-800">
                  Attention items to resolve
                </span>
              </div>
              <ul className="space-y-1">
                {highRisks.map((risk, idx) => (
                  <li key={idx} className="text-sm text-amber-800">
                    • {risk.description}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => onGoBack("risk")}
                className="mt-3 text-sm text-amber-800 hover:text-amber-900 underline"
              >
                Review Cost Reality →
              </button>
            </div>
          )}

          {/* AI Recommendation */}
          <div className="bg-white border border-[#E0D4BF] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#4A331D] uppercase tracking-wider">
                AI Analysis
              </h3>
              <button
                onClick={getAIRecommendation}
                disabled={loadingAI}
                className={`px-4 py-2 text-sm rounded-lg transition ${
                  loadingAI
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-[#2F2A25] text-white hover:bg-[#4A331D]"
                }`}
              >
                {loadingAI ? "Analyzing..." : aiRecommendation ? "Refresh Analysis" : "Get AI Recommendation"}
              </button>
            </div>

            {aiRecommendation ? (
              <div className="space-y-4">
                {/* AI Verdict Badge */}
                <div className="flex items-center gap-3">
                  <div className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                    aiRecommendation.verdict === "proceed"
                      ? "bg-green-100 text-green-700"
                      : aiRecommendation.verdict === "adjust"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    {aiRecommendation.verdict?.toUpperCase()}
                  </div>
                  <span className="text-xs text-[#8B7E6A]">
                    {aiRecommendation.confidence}% confidence
                  </span>
                </div>

                {/* Summary */}
                <p className="text-sm text-[#4A331D]">{aiRecommendation.summary}</p>

                {/* Reasoning */}
                {aiRecommendation.reasoning.length > 0 && (
                  <div>
                    <div className="text-xs text-[#8B7E6A] uppercase tracking-wider mb-1">Key Factors</div>
                    <ul className="text-sm text-[#4A331D] space-y-1">
                      {aiRecommendation.reasoning.map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Improvements (if adjust or decline) */}
                {aiRecommendation.improvements.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="text-xs text-amber-700 uppercase tracking-wider mb-1">
                      To Improve
                    </div>
                    <ul className="text-sm text-amber-800 space-y-1">
                      {aiRecommendation.improvements.map((imp, i) => (
                        <li key={i}>• {imp}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Warnings */}
                {aiRecommendation.warnings.length > 0 && (
                  <div>
                    <div className="text-xs text-[#8B7E6A] uppercase tracking-wider mb-1">Watch Out For</div>
                    <ul className="text-sm text-[#6F6352] space-y-1">
                      {aiRecommendation.warnings.map((w, i) => (
                        <li key={i}>⚠ {w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Profitability */}
                <div className="text-xs text-[#8B7E6A] pt-2 border-t border-[#E0D4BF]">
                  <span className="uppercase tracking-wider">Financial: </span>
                  <span className="text-[#4A331D]">{aiRecommendation.profitabilityAssessment}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#8B7E6A]">
                Click "Get AI Recommendation" for an automated feasibility analysis based on your event data.
              </p>
            )}
          </div>

          {/* Verdict selection */}
          <div>
            <h3 className="text-sm font-semibold text-[#4A331D] uppercase tracking-wider mb-4">
              Your Decision
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {/* Proceed */}
              <button
                onClick={() => setSelectedVerdict("proceed")}
                className={`p-6 rounded-xl border-2 transition text-center ${
                  selectedVerdict === "proceed"
                    ? "border-green-500 bg-green-50"
                    : "border-[#E0D4BF] bg-white hover:border-green-300 hover:bg-green-50/50"
                }`}
              >
                <div className="text-3xl mb-2">✓</div>
                <div className="text-lg font-semibold text-green-700">PROCEED</div>
                <div className="text-xs text-[#8B7E6A] mt-1">Confirm and move forward</div>
              </button>

              {/* Adjust */}
              <button
                onClick={() => setSelectedVerdict("adjust")}
                className={`p-6 rounded-xl border-2 transition text-center ${
                  selectedVerdict === "adjust"
                    ? "border-amber-500 bg-amber-50"
                    : "border-[#E0D4BF] bg-white hover:border-amber-300 hover:bg-amber-50/50"
                }`}
              >
                <div className="text-3xl mb-2">↻</div>
                <div className="text-lg font-semibold text-amber-700">ADJUST</div>
                <div className="text-xs text-[#8B7E6A] mt-1">Needs modifications</div>
              </button>

              {/* Decline */}
              <button
                onClick={() => setSelectedVerdict("decline")}
                className={`p-6 rounded-xl border-2 transition text-center ${
                  selectedVerdict === "decline"
                    ? "border-red-500 bg-red-50"
                    : "border-[#E0D4BF] bg-white hover:border-red-300 hover:bg-red-50/50"
                }`}
              >
                <div className="text-3xl mb-2">✗</div>
                <div className="text-lg font-semibold text-red-700">DECLINE</div>
                <div className="text-xs text-[#8B7E6A] mt-1">Not taking this event</div>
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-[#4A331D] block mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                selectedVerdict === "adjust"
                  ? "What needs to change?"
                  : selectedVerdict === "decline"
                  ? "Reason for declining..."
                  : "Any additional notes..."
              }
              rows={3}
              className="w-full px-4 py-3 bg-white border border-[#E0D4BF] rounded-lg text-sm text-[#2F2A25] focus:outline-none focus:border-[#C5B8A5] resize-none"
            />
          </div>

          {/* Confirm button */}
          <div className="flex justify-center pt-4">
            <button
              onClick={handleConfirm}
              disabled={!selectedVerdict}
              className={`px-8 py-3 rounded-lg text-lg font-semibold transition ${
                selectedVerdict
                  ? selectedVerdict === "proceed"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : selectedVerdict === "adjust"
                    ? "bg-amber-600 text-white hover:bg-amber-700"
                    : "bg-red-600 text-white hover:bg-red-700"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              Confirm {selectedVerdict ? selectedVerdict.charAt(0).toUpperCase() + selectedVerdict.slice(1) : "Decision"}
            </button>
          </div>

          {/* Adjust: go back options */}
          {selectedVerdict === "adjust" && (
            <div className="text-center pt-2">
              <span className="text-sm text-[#8B7E6A]">Go back to: </span>
              {[
                { phase: "menu", label: "Menu Design" },
                { phase: "cost", label: "Execution Plan" },
                { phase: "risk", label: "Cost Reality" },
              ].map(({ phase, label }) => (
                <button
                  key={phase}
                  onClick={() => onGoBack(phase)}
                  className="text-sm text-[#4A331D] hover:underline mx-2"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export type { EventVerdict };

