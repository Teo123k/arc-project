"use client";

import { useMemo, useState } from "react";

type TriggerKind = "daily" | "weekly" | "once";

interface AutoTrigger {
  kind: TriggerKind;
  time?: string;
  dayOfWeek?: string;
  raw?: string;
}

interface AutoAction {
  type: "reminder";
  message: string;
}

export interface AutoTaskDefinition {
  id: string;
  trigger: AutoTrigger;
  action: AutoAction;
}

interface AutoTaskWidgetProps {
  data?: AutoTaskDefinition[];
}

export default function AutoTaskWidget({ data }: AutoTaskWidgetProps) {
  const [open, setOpen] = useState(true);

  const tasks = useMemo(
    () => (Array.isArray(data) ? data : []),
    [data]
  );

  const count = tasks.length;
  const latest = count > 0 ? tasks[count - 1] : undefined;

  const compactLabel =
    latest
      ? `${formatTrigger(latest.trigger)} — ${latest.action.message}`
      : "No automations yet";

  return (
    <div
      className="bg-white border border-[#D9C7A1] rounded-xl shadow-sm overflow-hidden cursor-pointer transition hover:shadow-md"
      style={{ width: 260 }}
      onClick={() => setOpen((v) => !v)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#FBF7F0]">
        <div>
          <div className="text-xs font-semibold text-[#4A331D] flex items-center gap-1">
            <span>⚙️</span>
            <span>Auto Tasks</span>
          </div>
          <div className="text-[11px] text-gray-600">
            {count} active automation{count === 1 ? "" : "s"}
          </div>
        </div>
        <div className="text-xs text-[#4A331D]">
          {open ? "▾" : "▸"}
        </div>
      </div>

      {/* Body */}
      {open ? (
        <div className="px-3 py-2 space-y-2">
          {count === 0 && (
            <p className="text-[11px] text-gray-500">
              Tell ARC something like:
              <br />
              <span className="italic">
                “Remind me every morning at 7 to meditate.”
              </span>
            </p>
          )}

          {tasks.map((t) => (
            <div
              key={t.id}
              className="border border-[#E5D9C5] rounded-md px-2 py-2 bg-[#FFFCF7]"
            >
              <div className="text-[11px] font-semibold text-[#4A331D] mb-1">
                {formatTrigger(t.trigger)}
              </div>
              <div className="text-[11px] text-gray-700">
                {t.action.message}
              </div>
            </div>
          ))}

          <p className="text-[10px] text-gray-400 pt-1">
            WhatsApp connection will be added later. For now, ARC just stores your auto-tasks.
          </p>
        </div>
      ) : (
        <div className="px-3 py-2">
          <p className="text-[11px] text-gray-700 truncate">{compactLabel}</p>
        </div>
      )}
    </div>
  );
}

function formatTrigger(trigger: AutoTrigger): string {
  if (trigger.kind === "daily") {
    return trigger.time ? `Daily at ${trigger.time}` : "Daily";
  }
  if (trigger.kind === "weekly") {
    const day = trigger.dayOfWeek ?? "weekly";
    return trigger.time ? `${capitalize(day)} at ${trigger.time}` : capitalize(day);
  }
  if (trigger.kind === "once") {
    if (trigger.time && trigger.raw?.toLowerCase().includes("tomorrow")) {
      return `Once: tomorrow at ${trigger.time}`;
    }
    if (trigger.time) return `Once at ${trigger.time}`;
    return "One-time";
  }
  return "Automation";
}

function capitalize(value?: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
