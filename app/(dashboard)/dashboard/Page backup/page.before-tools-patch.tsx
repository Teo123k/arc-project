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
type Zone = "priority" | "tools" | "automation" | "work";

interface WidgetEntry {
  id: string;
  type: WidgetType;
  component: any;
  data?: any;
  zone: Zone;
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

  // Decide where each widget lives (priority / tools / automation / work)
  function decideZone(type: WidgetType): Zone {
    if (type === "autoTask") return "automation";

    if (type === "manual") {
      const hasPriority = widgets.some((w) => w.zone === "priority");
      // First manual becomes today's focus, others go into tools
      return hasPriority ? "tools" : "priority";
    }

    // video, email, marketing => tools by default
    return "tools";
  }

  function addWidget(type: WidgetType, payload?: any) {
    const Component = widgetMap[type];
    if (!Component) return;

    // Avoid duplicate singletons (video / email / marketing)
    if (
      (type === "video" || type === "email" || type === "marketing") &&
      widgets.some((w) => w.type === type)
    ) {
      return;
    }

    const zone = decideZone(type);

    setWidgets((prev) => [
      ...prev,
      {
        id: `${type}-${Date.now()}`,
        type,
        component: Component,
        data: payload || null,
        zone,
      },
    ]);
  }

  return (
    <div className="w-full h-screen flex bg-[#F8F1E6]">
      {/* MAIN CANVAS */}
      <div className="flex-1 p-6 overflow-auto relative">
        <WidgetBoard widgets={widgets} setWidgets={setWidgets} />

        {/* Plus button: top-right of main canvas */}
        <div className="absolute top-4 right-4 z-50">
          <FloatingAddButton
            onSelect={(type) => addWidget(type as WidgetType)}
          />
        </div>
      </div>

      {/* CHAT SIDEBAR — unchanged, stays on the right */}
      <div className="w-[340px] border-l bg-[#F3E6D3] p-4 flex flex-col">
        <h2
          className="text-lg font-semibold mb-3"
          style={{ color: "#4A331D" }}
        >
          ARC — Conversation
        </h2>
        <div className="flex-1 overflow-hidden">
          <ARCChat
            onWidgetRequest={(type: string, payload?: any) => {
              if (
                type === "video" ||
                type === "email" ||
                type === "marketing" ||
                type === "manual" ||
                type === "autoTask"
              ) {
                addWidget(type as WidgetType, payload);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

