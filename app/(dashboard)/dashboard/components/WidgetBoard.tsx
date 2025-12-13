"use client";

export default function WidgetBoard() {
  return (
    <div className="w-full h-full">
      <div className="grid grid-cols-[360px,1fr] grid-rows-[240px,1fr,140px] gap-6 h-full">
        {/* TODAY'S FOCUS */}
        <section className="border border-[#E0D4BF] rounded-3xl bg-[#FDF7EE] p-4 shadow-sm">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-[#A4865A] uppercase mb-1">
            Today’s Focus
          </p>
          <div className="h-[200px] flex items-center justify-center text-[#C3A987] text-[12px]">
            Waiting for intention
          </div>
        </section>

        {/* WORKSPACE */}
        <section className="row-span-2 border border-[#E0D4BF] rounded-3xl bg-[#FBF4E8]" />

        {/* TOOLS */}
        <section className="row-span-2 border border-[#E0D4BF] rounded-3xl bg-[#FBF4E8]" />

        {/* AUTOMATIONS */}
        <section className="col-start-2 border border-[#E0D4BF] rounded-3xl bg-[#FBF4E8]" />
      </div>
    </div>
  );
}
