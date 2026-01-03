"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

type OperationStep = {
  id: string;
  time: string;
  task: string;
  duration: string;
  notes?: string;
  category?: "prep" | "cooking" | "service" | "cleanup";
  assignedTo?: string;
};

type ChefAssignment = {
  id: string;
  name: string;
  role: "head" | "chef" | "assistant";
};

type TimelineData = {
  eventName: string;
  eventDate?: string;
  serviceStart?: string;
  serviceEnd?: string;
  guestCount?: number;
  operations: OperationStep[];
  chefs: ChefAssignment[];
  taskAssignments: Record<string, string>;
};

// ────────────────────────────────────────────────────────────────────────────
// COMPONENT — Read-only Shared Timeline View
// ────────────────────────────────────────────────────────────────────────────

export default function SharedTimelinePage() {
  const params = useParams();
  const shareId = params?.id as string;
  
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!shareId) return;
    
    async function fetchTimeline() {
      try {
        const res = await fetch(`/api/arc/share-timeline?id=${shareId}`);
        const data = await res.json();
        
        if (!res.ok) {
          setError(data.error || "Failed to load timeline");
          return;
        }
        
        setTimeline(data.timeline);
      } catch (err) {
        setError("Failed to load timeline");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchTimeline();
  }, [shareId]);

  const toggleTask = (id: string) => {
    const newSet = new Set(completedTasks);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setCompletedTasks(newSet);
  };

  // Group operations by category
  const operationsByCategory = timeline?.operations.reduce(
    (acc, op) => {
      const cat = op.category || "prep";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(op);
      return acc;
    },
    {} as Record<string, OperationStep[]>
  ) || {};

  const categoryOrder = ["prep", "cooking", "service", "cleanup"];
  const categoryLabels: Record<string, string> = {
    prep: "Prep Work",
    cooking: "Cooking",
    service: "Service",
    cleanup: "Cleanup",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#4A331D] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-[#8B7E6A]">Loading timeline...</p>
        </div>
      </div>
    );
  }

  if (error || !timeline) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <h1 className="text-2xl font-bold text-[#2F2A25] mb-4">Timeline Not Found</h1>
          <p className="text-[#8B7E6A]">
            {error || "This timeline may have expired or the link is invalid."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <div
        className="bg-white min-h-screen py-8 px-6 print:p-0"
        style={{
          maxWidth: "210mm",
          margin: "0 auto",
          fontFamily: "'Georgia', 'Times New Roman', serif",
        }}
      >
        {/* Header */}
        <div className="border-b-2 border-[#2F2A25] pb-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8B7E6A] uppercase tracking-wider">
              Shared Timeline
            </span>
            <button
              onClick={() => window.print()}
              className="print:hidden px-3 py-1.5 text-sm border border-[#E0D4BF] rounded-lg hover:bg-[#FBF4E8] transition"
            >
              Print
            </button>
          </div>
          <h1 className="text-2xl font-bold text-[#2F2A25] mt-2">{timeline.eventName}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-[#6F6352]">
            {timeline.eventDate && <span>{timeline.eventDate}</span>}
            {timeline.serviceStart && timeline.serviceEnd && (
              <span>
                Service: {timeline.serviceStart} – {timeline.serviceEnd}
              </span>
            )}
            {timeline.guestCount && <span>{timeline.guestCount} guests</span>}
          </div>
        </div>

        {/* Team legend */}
        {timeline.chefs.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-3 text-xs">
            {timeline.chefs.map((chef) => (
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
                    const assignedChefId = timeline.taskAssignments[op.id] || op.assignedTo;
                    const assignedChef = timeline.chefs.find((c) => c.id === assignedChefId);

                    return (
                      <div
                        key={op.id}
                        className={`flex items-start gap-2 py-1.5 transition ${
                          isCompleted ? "opacity-50" : ""
                        }`}
                      >
                        {/* Checkbox */}
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

                        {/* Assignment badge */}
                        {assignedChef && (
                          <span className="text-xs text-[#6F6352] w-20 shrink-0">
                            [{assignedChef.name}]
                          </span>
                        )}

                        {/* Task */}
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

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-[#E0D4BF] text-center">
          <p className="text-xs text-[#A89D8A]">
            Generated by ARC
          </p>
        </div>
      </div>
    </div>
  );
}

