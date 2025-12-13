"use client";

import type { WidgetId } from "./WidgetBoard";

interface SidebarProps {
  active: WidgetId;
  onSelect: (id: WidgetId) => void;
}

const items: { id: WidgetId; label: string; section?: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "quarter", label: "3-Month Roadmap" },
  { id: "video", label: "Video Editing", section: "Workflows" },
  { id: "seo", label: "SEO & Marketing", section: "Workflows" },
  { id: "email", label: "Email Writer", section: "Workflows" },
  { id: "scheduler", label: "Content Scheduler", section: "Workflows" },
  { id: "automation", label: "Automations", section: "Automations" },
  { id: "scoreboard", label: "Scoreboard", section: "Insights" },
  { id: "roadmap", label: "Roadmap", section: "Insights" },
];

export default function Sidebar({ active, onSelect }: SidebarProps) {
  const grouped: Record<string, typeof items> = {};

  for (const item of items) {
    const key = item.section ?? "Focus";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }

  return (
    <div className="w-[220px] h-screen border-r border-[#DDCBA8] bg-[#F6EDDD] flex flex-col justify-between">
      <div className="p-4 space-y-4">
        <div>
          <div className="text-xs font-semibold tracking-[0.12em] uppercase text-[#A07B47] mb-1">
            ARC
          </div>
          <div className="text-sm font-semibold text-[#4A331D]">
            Modular Action OS
          </div>
        </div>

        <div className="space-y-4 text-[13px]">
          {Object.entries(grouped).map(([section, sectionItems]) => (
            <div key={section}>
              <div className="text-[11px] uppercase tracking-[0.16em] text-[#B08B57] mb-1">
                {section}
              </div>
              <div className="space-y-1">
                {sectionItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg transition
                      ${
                        active === item.id
                          ? "bg-[#E7D4B7] text-[#3C2915] font-semibold"
                          : "text-[#5E4930] hover:bg-[#F0E1C9]"
                      }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-[#DDCBA8] text-[11px] text-[#8A7453]">
        <div className="mb-1 font-medium">Today</div>
        <div>Stay with one step. Let ARC handle the rest.</div>
      </div>
    </div>
  );
}
