"use client";

import { useState } from "react";

interface WidgetCardProps {
  title: string;
  summary: string;
  children: React.ReactNode;
}

export default function WidgetCard({ title, summary, children }: WidgetCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="border border-[#D9C7A1] rounded-lg bg-white shadow-sm transition-all duration-300 overflow-hidden"
      style={{
        maxHeight: open ? "1000px" : "74px",
        cursor: "pointer",
      }}
      onClick={() => setOpen(!open)}
    >
      {/* Compact Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#FBF7F0]">
        <div>
          <h3 className="text-[15px] font-semibold text-[#4A331D]">{title}</h3>
          {!open && (
            <p className="text-[12px] text-gray-600 mt-1 truncate w-[220px]">
              {summary}
            </p>
          )}
        </div>

        <span className="text-[#4A331D] text-xl select-none">
          {open ? "▾" : "▸"}
        </span>
      </div>

      {/* Expanded Content */}
      <div className="px-4 py-4">{open && children}</div>
    </div>
  );
}
