"use client";

import ARCChat from "@/shared/ui/arc/ARCChat";

export default function DashboardPage() {
  return (
    <div className="w-full h-screen flex bg-[#F8F1E6]">
      {/* LEFT CANVAS */}
      <div className="flex-1 p-6">
        <div className="grid grid-cols-[360px,1fr] grid-rows-[220px,1fr,140px] gap-6 h-full">
          
          {/* TODAY'S FOCUS (KEEP TEXT) */}
          <section className="border border-[#E0D4BF] rounded-3xl bg-[#FDF7EE] p-4 shadow-sm">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-[#A4865A] uppercase mb-2">
              Today’s Focus
            </p>

            <div className="w-full h-full flex items-center justify-center">
              <p className="text-[12px] text-[#C3A987] text-center px-6">
                When you turn a plan into a daily step, it appears here.
              </p>
            </div>
          </section>

          {/* ARK WORKSPACE (FRAME ONLY) */}
          <section className="row-span-2 border border-[#E0D4BF] rounded-3xl bg-[#FBF4E8] p-6 shadow-sm">
            <div className="w-full h-full rounded-2xl border border-dashed border-[#E0D4BF] bg-[#FDF0DF]" />
          </section>

          {/* TOOLS (FRAME ONLY) */}
          <section className="row-span-2 border border-[#E0D4BF] rounded-3xl bg-[#FBF4E8] p-4 shadow-sm" />

          {/* AUTOMATIONS (FRAME ONLY) */}
          <section className="col-start-2 border border-[#E0D4BF] rounded-3xl bg-[#FBF4E8] p-4 shadow-sm" />
        </div>
      </div>

      {/* RIGHT SIDEBAR — CHAT */}
      <div className="w-[340px] h-screen border-l bg-[#F3E6D3] p-4 flex flex-col overflow-hidden">
        <h2
          className="text-lg font-semibold mb-3"
          style={{ color: "#4A331D" }}
        >
          ARC — Conversation
        </h2>

        <div className="flex-1 min-h-0 overflow-hidden">
          <ARCChat />
        </div>
      </div>
    </div>
  );
}

