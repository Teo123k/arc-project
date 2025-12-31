"use client";

import { useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

type RiskSeverity = "high" | "medium" | "low" | "ok";
type RiskCategory = "staffing" | "equipment" | "timing" | "ingredients" | "weather" | "budget";

type EventRisk = {
  id: string;
  severity: RiskSeverity;
  category: RiskCategory;
  description: string;
  mitigation?: string;
};

interface RiskAssessmentProps {
  risks: EventRisk[];
  onUpdate: (risks: EventRisk[]) => void;
  // Context for AI suggestions
  guestCount?: number;
  menuComplexity?: number;
  prepTimeHours?: number;
  hasTransport?: boolean;
  budgetMargin?: number;
}

const CATEGORY_LABELS: Record<RiskCategory, string> = {
  staffing: "Staffing",
  equipment: "Equipment",
  timing: "Timing",
  ingredients: "Ingredients",
  weather: "Weather / Venue",
  budget: "Budget",
};

const SEVERITY_STYLES: Record<RiskSeverity, { bg: string; text: string; icon: string }> = {
  high: { bg: "bg-red-50", text: "text-red-700", icon: "⚠" },
  medium: { bg: "bg-amber-50", text: "text-amber-700", icon: "⚠" },
  low: { bg: "bg-blue-50", text: "text-blue-700", icon: "⚠" },
  ok: { bg: "bg-green-50", text: "text-green-700", icon: "✓" },
};

// ────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ────────────────────────────────────────────────────────────────────────────

export function RiskAssessment({
  risks,
  onUpdate,
  guestCount,
  menuComplexity,
  prepTimeHours,
  hasTransport,
  budgetMargin,
}: RiskAssessmentProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add a new risk
  const addRisk = () => {
    const newRisk: EventRisk = {
      id: crypto.randomUUID(),
      severity: "medium",
      category: "timing",
      description: "",
      mitigation: "",
    };
    onUpdate([...risks, newRisk]);
    setEditingId(newRisk.id);
  };

  // Update a risk
  const updateRisk = (id: string, updates: Partial<EventRisk>) => {
    onUpdate(risks.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  // Remove a risk
  const removeRisk = (id: string) => {
    onUpdate(risks.filter((r) => r.id !== id));
  };

  // Auto-generate suggestions based on context
  const generateSuggestions = (): EventRisk[] => {
    const suggestions: EventRisk[] = [];

    if (prepTimeHours && prepTimeHours > 6) {
      suggestions.push({
        id: crypto.randomUUID(),
        severity: "high",
        category: "timing",
        description: `Prep time is high (${prepTimeHours}h). Risk of running behind schedule.`,
        mitigation: "Consider pre-prep or simpler dishes",
      });
    }

    if (guestCount && guestCount > 50) {
      suggestions.push({
        id: crypto.randomUUID(),
        severity: "medium",
        category: "staffing",
        description: `Large event (${guestCount} guests). Standard team may be stretched.`,
        mitigation: "Consider adding extra kitchen help",
      });
    }

    if (hasTransport) {
      suggestions.push({
        id: crypto.randomUUID(),
        severity: "medium",
        category: "equipment",
        description: "Transport required. Hot holding and food safety concerns.",
        mitigation: "Ensure proper transport containers and temperature monitoring",
      });
    }

    if (budgetMargin !== undefined && budgetMargin < 20) {
      suggestions.push({
        id: crypto.randomUUID(),
        severity: budgetMargin < 10 ? "high" : "medium",
        category: "budget",
        description: `Tight margin (${budgetMargin}%). Little room for unexpected costs.`,
        mitigation: "Review ingredient costs, consider simpler alternatives",
      });
    }

    // Default OK items
    if (suggestions.length === 0) {
      suggestions.push({
        id: crypto.randomUUID(),
        severity: "ok",
        category: "staffing",
        description: "Team capacity looks adequate",
      });
    }

    return suggestions;
  };

  // Apply suggestions
  const applySuggestions = () => {
    const suggestions = generateSuggestions();
    // Only add suggestions that don't already exist (by description)
    const existingDescriptions = new Set(risks.map((r) => r.description));
    const newSuggestions = suggestions.filter((s) => !existingDescriptions.has(s.description));
    if (newSuggestions.length > 0) {
      onUpdate([...risks, ...newSuggestions]);
    }
  };

  // Sort risks by severity
  const sortedRisks = [...risks].sort((a, b) => {
    const severityOrder: RiskSeverity[] = ["high", "medium", "low", "ok"];
    return severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
  });

  // Count by severity
  const highCount = risks.filter((r) => r.severity === "high").length;
  const mediumCount = risks.filter((r) => r.severity === "medium").length;
  const okCount = risks.filter((r) => r.severity === "ok").length;

  return (
    <div className="h-full flex flex-col bg-[#FAF8F4]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0D4BF]">
        <div>
          <h2 className="text-lg font-semibold text-[#2F2A25]">Risks & Gaps</h2>
          <p className="text-sm text-[#8B7E6A]">
            Senior-chef check: what could break service, margin, or timing?
          </p>
        </div>
        <button
          onClick={applySuggestions}
          className="px-4 py-2 text-sm bg-[#E8DFD0] hover:bg-[#DED4C3] text-[#4A331D] rounded-lg transition"
        >
          Suggest checks
        </button>
      </div>

      {/* Summary bar */}
      <div className="flex gap-4 px-6 py-3 border-b border-[#E0D4BF] bg-[#FBF4E8]">
        {highCount > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-red-500 font-bold">{highCount}</span>
            <span className="text-red-600">High</span>
          </div>
        )}
        {mediumCount > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-amber-500 font-bold">{mediumCount}</span>
            <span className="text-amber-600">Medium</span>
          </div>
        )}
        {okCount > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-green-500 font-bold">{okCount}</span>
            <span className="text-green-600">OK</span>
          </div>
        )}
        {risks.length === 0 && (
          <span className="text-sm text-[#8B7E6A]">No risks identified yet</span>
        )}
      </div>

      {/* Risks list */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-3">
          {sortedRisks.map((risk) => {
            const style = SEVERITY_STYLES[risk.severity];
            const isEditing = editingId === risk.id;

            return (
              <div
                key={risk.id}
                className={`p-4 rounded-lg border ${style.bg} ${
                  isEditing ? "border-[#C5B8A5]" : "border-transparent"
                }`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    {/* Edit mode */}
                    <div className="flex gap-3">
                      <select
                        value={risk.severity}
                        onChange={(e) => updateRisk(risk.id, { severity: e.target.value as RiskSeverity })}
                        className="px-2 py-1 bg-white border border-[#E0D4BF] rounded text-sm"
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                        <option value="ok">OK</option>
                      </select>
                      <select
                        value={risk.category}
                        onChange={(e) => updateRisk(risk.id, { category: e.target.value as RiskCategory })}
                        className="px-2 py-1 bg-white border border-[#E0D4BF] rounded text-sm"
                      >
                        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="text"
                      value={risk.description}
                      onChange={(e) => updateRisk(risk.id, { description: e.target.value })}
                      placeholder="Describe the risk..."
                      className="w-full px-3 py-2 bg-white border border-[#E0D4BF] rounded-lg text-sm focus:outline-none focus:border-[#C5B8A5]"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={risk.mitigation || ""}
                      onChange={(e) => updateRisk(risk.id, { mitigation: e.target.value })}
                      placeholder="Mitigation plan (optional)..."
                      className="w-full px-3 py-2 bg-white border border-[#E0D4BF] rounded-lg text-sm focus:outline-none focus:border-[#C5B8A5]"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => removeRisk(risk.id)}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 text-sm bg-[#2F2A25] text-white rounded hover:bg-[#4A331D] transition"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="cursor-pointer"
                    onClick={() => setEditingId(risk.id)}
                  >
                    {/* View mode */}
                    <div className="flex items-start gap-3">
                      <span className={`text-lg ${style.text}`}>{style.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold uppercase ${style.text}`}>
                            {risk.severity}
                          </span>
                          <span className="text-xs text-[#8B7E6A]">
                            {CATEGORY_LABELS[risk.category]}
                          </span>
                        </div>
                        <p className={`text-sm ${style.text}`}>{risk.description}</p>
                        {risk.mitigation && (
                          <p className="mt-1 text-sm text-[#6F6352]">
                            → {risk.mitigation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add risk button */}
        <button
          onClick={addRisk}
          className="mt-4 w-full py-3 border-2 border-dashed border-[#E0D4BF] rounded-lg text-sm text-[#8B7E6A] hover:border-[#C5B8A5] hover:text-[#4A331D] transition"
        >
          + Add risk
        </button>
      </div>
    </div>
  );
}

export type { EventRisk, RiskSeverity, RiskCategory };

