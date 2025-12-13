"use client";

import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor
} from "@dnd-kit/core";

import { restrictToWindowEdges } from "@dnd-kit/modifiers";

export default function HybridCanvas({ children }) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  return (
    <div className="relative w-full h-full">
      <DndContext
        sensors={sensors}
        modifiers={[restrictToWindowEdges]}
      >
        {children}
      </DndContext>
    </div>
  );
}