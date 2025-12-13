"use client";

import { useState } from "react";

type WidgetType = "manual" | "video" | "email" | "marketing" | "autoTask";

interface FloatingAddButtonProps {
  onSelect: (type: WidgetType) => void;
}

export default function FloatingAddButton({ onSelect }: FloatingAddButtonProps) {
  const [open, setOpen] = useState(false);

  function handleSelect(type: WidgetType) {
    onSelect(type);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full bg-[#4A331D] text-white text-xl flex items-center justify-center shadow-md hover:bg-[#6B4A2E] transition"
      >
        +
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-xl border border-[#E0D2B8] bg-[#FBF7EF] shadow-lg text-[13px] py-1 z-50">
          <button className="w-full text-left px-3 py-2 hover:bg-[#F1E4D1]" onClick={() => handleSelect("manual")}>
            Manual task / plan
          </button>
          <button className="w-full text-left px-3 py-2 hover:bg-[#F1E4D1]" onClick={() => handleSelect("video")}>
            🎬 Video tool
          </button>
          <button className="w-full text-left px-3 py-2 hover:bg-[#F1E4D1]" onClick={() => handleSelect("email")}>
            ✉️ Email helper
          </button>
          <button className="w-full text-left px-3 py-2 hover:bg-[#F1E4D1]" onClick={() => handleSelect("marketing")}>
            📈 Marketing kit
          </button>
          <button className="w-full text-left px-3 py-2 hover:bg-[#F1E4D1]" onClick={() => handleSelect("autoTask")}>
            ⚙️ Automation hub
          </button>
        </div>
      )}
    </div>
  );
}
