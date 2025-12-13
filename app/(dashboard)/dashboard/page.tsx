"use client";

import { useEffect, useState } from "react";
import ARCChat from "@/shared/ui/arc/ARCChat";

type ARCState = {
  focus: string | null;
  nextStep: string | null;
};

const STORAGE_KEY = "arc.state";

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [arcState, setArcState] = useState<ARCState>({
    focus: null,
    nextStep: null,
  });

  // ✅ Prevent server/client mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load persisted state (client-only)
  useEffect(() => {
    if (!mounted) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setArcState(JSON.parse(saved));
      } catch {}
    }
  }, [mounted]);

  // Persist state
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arcState));
  }, [mounted, arcState]);

  // 🔑 CRITICAL: render nothing on server
  if (!mounted) return null;

  return (
    <div className="w-full h-screen flex bg-[#F8F1E6]">
      {/* LEFT CANVAS */}
      <div className="flex-1 p-6">
        <div className="grid grid-cols-[360px,1fr] grid-rows-[220px,1fr,140px] gap-6 h-full">

          {/* TODAY'S FOCUS */}
          <section className="border border-[#E0D4BF] rounded-3xl bg-[#FDF7EE] p-4 shadow-sm">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-[#A4865A] uppercase mb-2">
              Today’s Focus
            </p>

            <div className="w-full h-full flex items-center justify-center">
              <p className="text-[15px] text-[#4A331D] text-center px-6">
                {arcState.focus ?? "ARC is listening…"}
              </p>
            </div>
          </section>

          {/* MAIN WORKSPACE */}
          <section className="row-span-2 border border-[#E0D4BF] rounded-3xl bg-[#FBF4E8] p-6 shadow-sm flex items-center justify-center">
            <div className="w-full h-full rounded-2xl border border-dashed border-[#E0D4BF] bg-[#FDF0DF] flex items-center justify-center">
              <p className="text-[16px] text-[#6B5538] text-center max-w-md">
                {arcState.nextStep ?? "Your next step will appear here."}
              </p>
            </div>
          </section>

          <section className="row-span-2 border border-[#E0D4BF] rounded-3xl bg-[#FBF4E8] p-4 shadow-sm" />
          <section className="col-start-2 border border-[#E0D4BF] rounded-3xl bg-[#FBF4E8] p-4 shadow-sm" />
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="w-[340px] h-screen border-l bg-[#F3E6D3] p-4 flex flex-col overflow-hidden">
        <h2 className="text-lg font-semibold mb-3" style={{ color: "#4A331D" }}>
          ARC — Conversation
        </h2>

        <div className="flex-1 min-h-0 overflow-hidden">
          <ARCChat
            onARCUpdate={(update) =>
              setArcState((prev) => ({ ...prev, ...update }))
            }
          />
        </div>
      </div>
    </div>
  );
}