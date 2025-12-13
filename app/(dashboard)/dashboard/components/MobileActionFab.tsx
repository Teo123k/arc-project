"use client";

import { useState } from "react";

export default function MobileActionFab() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 md:hidden z-30">
      {/* Radial mini buttons */}
      {open && (
        <div className="mb-3 flex flex-col items-end gap-2">
          <button
            onClick={() => {
              console.log("mobile:breakdown");
              setOpen(false);
            }}
            className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-sm"
          >
            🧩
          </button>
          <button
            onClick={() => {
              console.log("mobile:automation");
              setOpen(false);
            }}
            className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-sm"
          >
            ⚡
          </button>
          <button
            onClick={() => {
              console.log("mobile:dashboard");
              setOpen(false);
            }}
            className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-sm"
          >
            📊
          </button>
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-12 h-12 rounded-full bg-[#4A331D] text-white shadow-lg flex items-center justify-center text-xl"
      >
        {open ? "×" : "⚡"}
      </button>
    </div>
  );
}
