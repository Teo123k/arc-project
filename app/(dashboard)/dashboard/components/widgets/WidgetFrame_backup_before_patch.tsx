"use client";

import { ReactNode, useState } from "react";

interface WidgetFrameProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  onClose?: () => void;
}

export default function WidgetFrame({
  title,
  icon,
  children,
  onClose,
}: WidgetFrameProps) {
  const [mode, setMode] = useState<"small" | "large">("small");

  // SMALL CARD (like phone widget icon)
  if (mode === "small") {
    return (
      <button
        type="button"
        onClick={() => setMode("large")}
        className="w-[180px] h-[120px] bg-white rounded-xl border border-neutral-200 shadow-sm hover:shadow-md transition flex flex-col justify-center px-4 text-left"
      >
        <div className="flex items-center gap-2 text-sm text-[#4A331D]">
          {icon}
          <span className="font-semibold">{title}</span>
        </div>
        <div className="text-xs text-neutral-500 mt-1">Tap to open</div>
      </button>
    );
  }

  // EXPANDED CARD (work mode)
  return (
    <div className="w-[360px] bg-white rounded-xl border border-neutral-200 shadow-md p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-[#4A331D]">{title}</h3>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("small")}
            className="px-2 py-1 text-[11px] rounded bg-neutral-100 hover:bg-neutral-200"
          >
            Collapse
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 text-[11px] rounded bg-neutral-100 hover:bg-red-100 text-red-600"
            >
              Close
            </button>
          )}
        </div>
      </div>

      <div className="text-[11px] text-neutral-500 mb-2">
        {/* optional subtitle later */}
      </div>

      <div className="space-y-3 text-sm text-neutral-800">{children}</div>
    </div>
  );
}
