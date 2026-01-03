"use client";

import React from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Zone = "priority" | "tools" | "automation" | "work";

type WidgetEntry = {
  id: string;
  type: string;
  component: any;
  data?: any;
  zone?: Zone;
};

interface WidgetBoardProps {
  widgets: WidgetEntry[];
  setWidgets: React.Dispatch<React.SetStateAction<WidgetEntry[]>>;
}

function SortableItem({ widget }: { widget: WidgetEntry }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: widget.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const C = widget.component;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center justify-center"
    >
      {/* Slight scale-down so 6 tools fit nicely */}
      <div className="scale-[0.9] origin-center">
        <C data={widget.data} />
      </div>
    </div>
  );
}

export default function WidgetBoard({ widgets, setWidgets }: WidgetBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor));

  const priority = widgets.find((w) => w.zone === "priority");
  const tools = widgets.filter((w) => w.zone === "tools");
  const automations = widgets.filter((w) => w.zone === "automation");
  const work = widgets.filter((w) => w.zone === "work");

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setWidgets((prev) => {
      const fromIndex = prev.findIndex((w) => w.id === active.id);
      const toIndex = prev.findIndex((w) => w.id === over.id);
      if (fromIndex === -1 || toIndex === -1) return prev;

      // 🔒 Do NOT allow crossing zones (tools stay in tools, etc.)
      if (prev[fromIndex].zone !== prev[toIndex].zone) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full h-full">
        <div className="grid grid-cols-[360px,1fr] grid-rows-[240px,1fr,140px] gap-6 h-full">
          {/* ---------------- LEFT COLUMN ---------------- */}

          {/* TODAY'S FOCUS */}
          <section className="border border-[#E0D4BF] rounded-3xl bg-[#FDF7EE] p-4 shadow-sm">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-[#A4865A] uppercase mb-1">
              Today's Focus
            </p>

            <p className="text-[12px] text-[#7A6243] mb-3">
              ARC pins one step here so your brain sees it first.
            </p>

            <div className="w-full h-[200px] flex items-center justify-center overflow-hidden">
              {priority ? (
                (() => {
                  const C = priority.component;

                  // If later you store a string summary in priority.data?.title,
                  // this will be the place to show it instead of full widget.
                  if (
                    priority.data &&
                    typeof (priority.data as any).title === "string"
                  ) {
                    return (
                      <div className="text-[13px] text-[#4A331D] text-center max-w-xs">
                        {(priority.data as any).title}
                      </div>
                    );
                  }

                  return <C data={priority.data} />;
                })()
              ) : (
                <p className="text-[12px] text-[#C3A987] text-center px-4">
                  When you turn a plan into a daily step, it appears here.
                </p>
              )}
            </div>
          </section>

          {/* ---------------- LEFT MIDDLE FRAME → ARK WORKSPACE ---------------- */}
         <section className="row-span-2 border border-[#E0D4BF] rounded-3xl bg-[#FBF4E8] p-4 shadow-sm flex flex-col">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-[#A4865A] uppercase mt-[-2px] pl-[2px] mb-1">
              
            </p>

            <p className="text-[12px] text-[#7A6243] mb-4">
              Heavy work, long steps, visual progress.
            </p>

            <div className="rounded-2xl border border-dashed border-[#E0D4BF] bg-[#FDF0DF] flex items-center justify-center p-10 h-full">
              (false {work.length > 0 ?{work.length > 0 ? work.length > 0 ? (
                (() => {
                  const w = work[0];
                  const C = w.component;
                  return <C data={w.data} />;
                })()
              ) : (
                <p className="text-[13px] text-[#B39974] text-center max-w-lg">
                  Expand a widget later to activate the main workspace.
                </p>
              )}
            </div>
          </section>

          {/* ---------------- RIGHT COLUMN ---------------- */}

          {/* RIGHT LARGE FRAME → TOOLS (2×3 GRID) */}
          <section className="row-span-2 border border-[#E0D4BF] rounded-3xl bg-[#FBF4E8] p-4 shadow-sm">
            <div className="flex justify-between mb-3">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-[#A4865A] uppercase">
                
              </p>
              <p className="text-[11px] text-[#B39974]">2 × 3</p>
            </div>

            <SortableContext
              items={tools.map((w) => w.id)}
              strategy={rectSortingStrategy}
            >
             <div className="grid grid-cols-2 grid-rows-3 gap-4 flex-1">
                {tools.length === 0 && (
                  <div className="col-span-2 flex items-center justify-center text-[#C3A987] text-[12px] text-center">
                    No tools added yet. Ask ARC for things like &quot;video editing&quot;,
                    &quot;email help&quot; or &quot;marketing plan&quot;.
                  </div>
                )}

                (false {tools.slice(0, 6).map{tools.slice(0, 6).map tools.slice(0, 6).map((w) => (
                  <SortableItem key={w.id} widget={w} />
                ))}
              </div>
            </SortableContext>
          </section>

          {/* AUTOMATIONS — SAME WIDTH AS WORKSPACE */}
          <section className="col-start-2 border border-[#E0D4BF] rounded-3xl bg-[#FBF4E8] p-4 shadow-sm flex flex-col justify-center">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-[#A4865A] uppercase mt-[-2px] pl-[2px] mb-1">
              
            </p>

            <SortableContext
              items={automations.map((w) => w.id)}
              strategy={rectSortingStrategy}
            >
              <div className="flex gap-4 items-center">
                {automations.length === 0 && (
                  <p className="text-[12px] text-[#C3A987]">
                    No automations yet. Later you&apos;ll say things like
                    &quot;Remind me every morning at 7 to meditate&quot; and ARC will add
                    a circle here.
                  </p>
                )}

                (false {automations.slice(0, 6).map{automations.slice(0, 6).map automations.slice(0, 6).map((w) => {
                  const C = w.component;
                  return (
                    <SortableItem
                      key={w.id}
                      widget={{
                        ...w,
                        component: (props: any) => (
                          <div className="w-16 h-16 rounded-full border border-[#D9C7A1] bg-white flex items-center justify-center shadow-sm overflow-hidden">
                            <div className="scale-[0.7] origin-center">
                              <C {...props} />
                            </div>
                          </div>
                        ),
                      }}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </section>
        </div>
      </div>
    </DndContext>
  );
}



