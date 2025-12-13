"use client";

interface PriorityBarProps {
  level: string;
  score: number;
}

export default function PriorityBar({ level, score }: PriorityBarProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const filled = Math.round((clamped / 100) * 10);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-semibold">Priority</span>
        <span>
          {level} ({clamped}/100)
        </span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded"
            style={{
              backgroundColor: i < filled ? "#B07F4E" : "#E3D5C4",
            }}
          />
        ))}
      </div>
    </div>
  );
}

