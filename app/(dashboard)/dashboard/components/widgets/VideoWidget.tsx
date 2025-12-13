"use client";
import { useState } from "react";

export default function VideoWidget() {
  const [expanded, setExpanded] = useState(false);
  const [full, setFull] = useState(false);

  if (!expanded) {
    // SMALL STATE
    return (
      <div
        onClick={() => setExpanded(true)}
        className="w-[160px] h-[120px] bg-white shadow-sm rounded-xl border border-neutral-200 p-3 cursor-pointer hover:shadow-md transition"
      >
        <div className="text-xl">🎬</div>
        <div className="font-semibold text-neutral-700 text-sm">Video Editing</div>
        <div className="text-xs text-neutral-500 mt-1">Tap to open</div>
      </div>
    );
  }

  if (!full) {
    // MEDIUM STATE
    return (
      <div className="w-full max-w-[420px] bg-white shadow-md rounded-xl border p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-md font-bold">🎬 Video Editing</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setFull(true)}
              className="text-xs px-2 py-1 rounded bg-neutral-200 hover:bg-neutral-300"
            >
              Expand
            </button>
            <button
              onClick={() => setExpanded(false)}
              className="text-xs px-2 py-1 rounded bg-neutral-200 hover:bg-neutral-300"
            >
              Collapse
            </button>
          </div>
        </div>

        <p className="text-sm text-neutral-600 mb-3">
          Upload a video and ARC will generate smart edits.
        </p>

        <button className="px-4 py-2 rounded bg-neutral-900 text-white hover:bg-neutral-700 w-full">
          Upload Video
        </button>
      </div>
    );
  }

  // LARGE STATE
  return (
    <div className="w-full max-w-[680px] bg-white shadow-lg rounded-xl border p-5 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-bold">🎬 Full Editing Suite</h3>
        <button
          onClick={() => setFull(false)}
          className="text-xs px-2 py-1 rounded bg-neutral-200 hover:bg-neutral-300"
        >
          Back
        </button>
      </div>

      <p className="text-sm text-neutral-700 mb-4">
        Full editing features will be placed here: timeline tools, AI presets, export, etc.
      </p>

      <div className="p-4 rounded border border-neutral-300 text-sm text-neutral-500">
        (Full UI placeholder)
      </div>
    </div>
  );
}
