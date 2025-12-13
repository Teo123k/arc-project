"use client";

import { useState } from "react";
import WidgetFrame from "./WidgetFrame";

interface ManualWidgetProps {
  data?: {
    title?: string;
    notes?: string;
  };
  onClose?: () => void;
}

export default function ManualWidget({ data, onClose }: ManualWidgetProps) {
  const [title, setTitle] = useState(data?.title ?? "");
  const [notes, setNotes] = useState(data?.notes ?? "");

  function handleSave() {
    // later: send to ARC / backend
    console.log("Manual task saved:", { title, notes });
  }

  return (
    <WidgetFrame
      title="Manual Task"
      icon={<span className="text-lg">📝</span>}
      onClose={onClose}
    >
      <div className="space-y-3">
        <input
          className="w-full border border-neutral-300 rounded px-3 py-2 text-sm"
          placeholder="Write a task..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          className="w-full border border-neutral-300 rounded px-3 py-2 text-sm min-h-[80px] resize-none"
          placeholder="Details, sub-steps, ideas…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <button
          type="button"
          onClick={handleSave}
          className="w-full bg-neutral-900 text-white text-sm py-2 rounded hover:bg-neutral-800"
        >
          Save Task
        </button>
      </div>
    </WidgetFrame>
  );
}
