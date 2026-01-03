"use client";

import { useState, useMemo } from "react";

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

type ChefRole = "head" | "chef" | "assistant";

type ChefAssignment = {
  id: string;
  name: string;
  role: ChefRole;
};

type OperationStep = {
  id: string;
  time: string;
  task: string;
  duration: string;
  notes?: string;
  category?: "prep" | "cooking" | "service" | "cleanup";
  assignedTo?: string; // Chef ID
};

interface ChefTimelineProps {
  eventName?: string;
  eventDate?: string;
  serviceStart?: string;
  serviceEnd?: string;
  operations?: OperationStep[];
  guestCount?: number;
  onShare?: () => void;
}

// ────────────────────────────────────────────────────────────────────────────
// CONSTANTS — Assistant-allowed tasks (hardcoded rules)
// ────────────────────────────────────────────────────────────────────────────

const ASSISTANT_ALLOWED_KEYWORDS = [
  "wash",
  "cut",
  "chop",
  "dice",
  "slice",
  "peel",
  "mix",
  "stir",
  "boil",
  "prep",
  "measure",
  "weigh",
  "clean",
  "setup",
  "arrange",
];

const ASSISTANT_FORBIDDEN_KEYWORDS = [
  "sauce",
  "protein",
  "meat",
  "fish",
  "sear",
  "grill",
  "roast",
  "plate",
  "plating",
  "finish",
  "season",
  "taste",
  "adjust",
];

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

function canAssistantDoTask(task: string): boolean {
  const lowerTask = task.toLowerCase();
  
  // Check for forbidden keywords first
  for (const keyword of ASSISTANT_FORBIDDEN_KEYWORDS) {
    if (lowerTask.includes(keyword)) return false;
  }
  
  // Check for allowed keywords
  for (const keyword of ASSISTANT_ALLOWED_KEYWORDS) {
    if (lowerTask.includes(keyword)) return true;
  }
  
  return false;
}

// ────────────────────────────────────────────────────────────────────────────
// COMPONENT — Printable A4 Chef Timeline
// ────────────────────────────────────────────────────────────────────────────

export function ChefTimeline({
  eventName = "Event",
  eventDate,
  serviceStart,
  serviceEnd,
  operations = [],
  guestCount,
  onShare,
}: ChefTimelineProps) {
  // Chef team state
  const [chefs, setChefs] = useState<ChefAssignment[]>([
    { id: "chef-1", name: "Head Chef", role: "head" },
  ]);
  const [showChefConfig, setShowChefConfig] = useState(false);
  
  // Task assignments (separate state to preserve on re-render)
  const [taskAssignments, setTaskAssignments] = useState<Record<string, string>>({});
  
  // Track completed tasks
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  const toggleTask = (id: string) => {
    const newSet = new Set(completedTasks);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setCompletedTasks(newSet);
  };

  const assignTask = (taskId: string, chefId: string) => {
    setTaskAssignments((prev) => ({
      ...prev,
      [taskId]: chefId,
    }));
  };

  const addChef = (role: ChefRole) => {
    const newId = `chef-${Date.now()}`;
    const roleLabel = role === "head" ? "Head Chef" : role === "chef" ? "Chef" : "Assistant";
    const count = chefs.filter((c) => c.role === role).length + 1;
    const name = role === "head" ? roleLabel : `${roleLabel} ${count}`;
    
    setChefs((prev) => [...prev, { id: newId, name, role }]);
  };

  const removeChef = (id: string) => {
    setChefs((prev) => prev.filter((c) => c.id !== id));
    // Remove assignments for this chef
    setTaskAssignments((prev) => {
      const updated = { ...prev };
      for (const [taskId, chefId] of Object.entries(updated)) {
        if (chefId === id) delete updated[taskId];
      }
      return updated;
    });
  };

  const updateChefName = (id: string, name: string) => {
    setChefs((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  };

  // Group operations by category
  const operationsByCategory = useMemo(() => {
    return operations.reduce(
      (acc, op) => {
        const cat = op.category || "prep";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(op);
        return acc;
      },
      {} as Record<string, OperationStep[]>
    );
  }, [operations]);

  const categoryOrder = ["prep", "cooking", "service", "cleanup"];
  const categoryLabels: Record<string, string> = {
    prep: "Prep Work",
    cooking: "Cooking",
    service: "Service",
    cleanup: "Cleanup",
  };

  // Filter chefs available for a task (based on assistant rules)
  const getAvailableChefsForTask = (task: string): ChefAssignment[] => {
    const canAssistantDo = canAssistantDoTask(task);
    return chefs.filter((c) => {
      if (c.role === "assistant" && !canAssistantDo) return false;
      return true;
    });
  };

  return (
    <div
      className="bg-white min-h-full print:p-0"
      style={{
        // A4 width for print
        maxWidth: "210mm",
        margin: "0 auto",
        fontFamily: "'Georgia', 'Times New Roman', serif",
      }}
    >
      {/* Header — Event info */}
      <div className="border-b-2 border-[#2F2A25] pb-4 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#2F2A25]">{eventName}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-[#6F6352]">
              {eventDate && <span>{eventDate}</span>}
              {serviceStart && serviceEnd && (
                <span>
                  Service: {serviceStart} – {serviceEnd}
                </span>
              )}
              {guestCount && <span>{guestCount} guests</span>}
            </div>
          </div>
          
          {/* Chef team toggle (hidden in print) */}
          <button
            onClick={() => setShowChefConfig(!showChefConfig)}
            className="print:hidden px-3 py-1.5 text-sm border border-[#E0D4BF] rounded-lg hover:bg-[#FBF4E8] transition"
          >
            {showChefConfig ? "Hide Team" : "Configure Team"} ({chefs.length})
          </button>
        </div>
        
        {/* Chef configuration panel (hidden in print) */}
        {showChefConfig && (
          <div className="mt-4 p-4 bg-[#FBF4E8] rounded-lg print:hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[#2F2A25]">Kitchen Team</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => addChef("chef")}
                  className="px-2 py-1 text-xs bg-[#4A331D] text-white rounded hover:bg-[#2F2A25]"
                >
                  + Chef
                </button>
                <button
                  onClick={() => addChef("assistant")}
                  className="px-2 py-1 text-xs border border-[#C4B8A6] text-[#4A331D] rounded hover:bg-white"
                >
                  + Assistant
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              {chefs.map((chef) => (
                <div key={chef.id} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    chef.role === "head" ? "bg-[#4A331D]" :
                    chef.role === "chef" ? "bg-[#8B7E6A]" :
                    "bg-[#C4B8A6]"
                  }`} />
                  <input
                    type="text"
                    value={chef.name}
                    onChange={(e) => updateChefName(chef.id, e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-[#E0D4BF] rounded bg-white"
                  />
                  <span className="text-xs text-[#8B7E6A] w-16">
                    {chef.role === "head" ? "Head" : chef.role === "chef" ? "Chef" : "Assist"}
                  </span>
                  {chefs.length > 1 && (
                    <button
                      onClick={() => removeChef(chef.id)}
                      className="text-[#8B7E6A] hover:text-red-600"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            {chefs.some((c) => c.role === "assistant") && (
              <p className="mt-3 text-xs text-[#8B7E6A]">
                Assistants can only do: Washing, Cutting veg, Mixing, Boiling, Prep setup
              </p>
            )}
          </div>
        )}
      </div>

      {/* Team legend (for print) */}
      {chefs.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-3 text-xs">
          {chefs.map((chef) => (
            <span key={chef.id} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${
                chef.role === "head" ? "bg-[#4A331D]" :
                chef.role === "chef" ? "bg-[#8B7E6A]" :
                "bg-[#C4B8A6]"
              }`} />
              {chef.name}
            </span>
          ))}
        </div>
      )}

      {/* Timeline content */}
      {operations.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-lg text-[#8B7E6A]">
            Timeline will appear once menu is selected.
          </p>
          <p className="text-sm text-[#A89D8A] mt-2">
            Add recipes to your menu to generate operations timeline.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {categoryOrder.map((cat) => {
            const ops = operationsByCategory[cat];
            if (!ops || ops.length === 0) return null;

            return (
              <section key={cat}>
                <h2 className="text-sm font-semibold text-[#4A331D] uppercase tracking-wider mb-2 pb-1 border-b border-[#E0D4BF]">
                  {categoryLabels[cat]}
                </h2>

                <div className="space-y-1">
                  {ops.map((op) => {
                    const isCompleted = completedTasks.has(op.id);
                    const assignedChefId = taskAssignments[op.id] || op.assignedTo;
                    const assignedChef = chefs.find((c) => c.id === assignedChefId);
                    const availableChefs = getAvailableChefsForTask(op.task);

                    return (
                      <div
                        key={op.id}
                        className={`flex items-start gap-2 py-1.5 transition ${
                          isCompleted ? "opacity-50" : ""
                        }`}
                      >
                        {/* Checkbox — interactive */}
                        <input
                          type="checkbox"
                          checked={isCompleted}
                          onChange={() => toggleTask(op.id)}
                          className="mt-0.5 w-4 h-4 rounded border-[#C4B8A6] text-[#4A331D] focus:ring-[#4A331D]"
                        />

                        {/* Time */}
                        <span className="w-14 text-sm font-medium text-[#4A331D] shrink-0">
                          {op.time}
                        </span>

                        {/* Assignment indicator */}
                        {chefs.length > 1 && (
                          <select
                            value={assignedChefId || ""}
                            onChange={(e) => assignTask(op.id, e.target.value)}
                            className="print:hidden w-20 text-xs border border-[#E0D4BF] rounded px-1 py-0.5 bg-white"
                          >
                            <option value="">—</option>
                            {availableChefs.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        )}
                        
                        {/* Print-only assignment badge */}
                        {assignedChef && (
                          <span className="hidden print:inline text-xs text-[#6F6352] w-20">
                            [{assignedChef.name}]
                          </span>
                        )}

                        {/* Task details */}
                        <div className="flex-1">
                          <p
                            className={`text-sm text-[#2F2A25] ${
                              isCompleted ? "line-through" : ""
                            }`}
                          >
                            {op.task}
                          </p>
                          {op.notes && (
                            <p className="text-xs text-[#8B7E6A] mt-0.5">
                              {op.notes}
                            </p>
                          )}
                        </div>

                        {/* Duration */}
                        <span className="text-xs text-[#8B7E6A] shrink-0">
                          {op.duration}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Footer — Actions */}
      <div className="mt-8 pt-4 border-t border-[#E0D4BF] flex items-center justify-between print:hidden">
        <p className="text-xs text-[#A89D8A]">
          Generated by ARC · Print with Ctrl+P
        </p>
        <div className="flex gap-2">
          {onShare && (
            <button
              onClick={onShare}
              className="px-4 py-2 text-sm bg-[#4A331D] text-white rounded-lg hover:bg-[#2F2A25] transition"
            >
              Share Timeline
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-sm text-[#4A331D] border border-[#E0D4BF] rounded-lg hover:bg-[#FBF4E8] transition"
          >
            Print / PDF
          </button>
        </div>
      </div>
      
      {/* Print footer */}
      <div className="hidden print:block mt-8 pt-4 border-t border-[#E0D4BF]">
        <p className="text-xs text-[#A89D8A] text-center">
          Generated by ARC
        </p>
      </div>
    </div>
  );
}

export type { OperationStep, ChefAssignment, ChefRole };
