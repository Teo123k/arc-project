"use client";

import { useState } from "react";
import ARCChat from "@/shared/ui/arc/ARCChat";
import FloatingAddButton from "./components/FloatingAddButton";
import WidgetBoard from "./components/WidgetBoard";

// Widgets
import VideoWidget from "./components/widgets/VideoWidget";
import EmailWidget from "./components/widgets/EmailWidget";
import MarketingWidget from "./components/widgets/MarketingWidget";
import ManualWidget from "./components/widgets/ManualWidget";
import AutoTaskWidget from "./components/widgets/AutoTaskWidget";

type WidgetType = "video" | "email" | "marketing" | "manual" | "autoTask";

interface WidgetEntry {
  zone?: "priority" | "work" | "archive";
  zone?: "priority" | "work" | "archive";
  id: string;
  type: WidgetType;
  component: any;
  data?: any;
  x?: number;
  y?: number;
}

const widgetMap: Record<WidgetType, any> = {
  video: VideoWidget,
  email: EmailWidget,
  marketing: MarketingWidget,
  manual: ManualWidget,
  autoTask: AutoTaskWidget,
};

export default function DashboardPage() {
  const [widgets, setWidgets] = useState<WidgetEntry[]>([]);

  // ----------------------------------------------------
  // UNIVERSAL ADD WIDGET FUNCTION
  // ----------------------------------------------------
  function addWidget(type: WidgetType, payload?: any) {
    const Component = widgetMap[type];
    if (!Component) return;

    // Prevent duplicates except manual
    if (type !== "manual" && widgets.some((w) => w.type === type)) return;

    setWidgets((prev) => [
      {
        id: `${type}-${Date.now()}`,
        type,
        component: Component,
        data: payload || null,
        x: 40 + prev.length * 40,
        y: 40 + prev.length * 40,
      },
      ...prev,
    ]);
  }

  return (
    <div className="w-full h-screen flex bg-[#F8F1E6]">

      {/* MAIN CANVAS */}
      <div className="flex-1 p-6 overflow-auto relative">
        <WidgetBoard widgets={widgets} setWidgets={setWidgets} />

        {/* Floating + button */}
        <div className="absolute top-4 right-4 z-50">
          <FloatingAddButton onSelect={(type) => addWidget(type)} />
        </div>
      </div>

      {/* CHAT SIDEBAR */}
      <div className="w-[340px] border-l bg-[#F3E6D3] p-4 flex flex-col">
        <ARCChat
          onWidgetRequest={(type, payload) => addWidget(type as WidgetType, payload)}
        />
      </div>

    </div>
  );
}