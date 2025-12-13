"use client";

interface ARCActionCardProps {
  action: {
    title: string;
    description: string;
  };
  priority: {
    level: string;
    score: number;
  };
  reasoning: string;
}

export default function ARCActionCard({ action, priority, reasoning }: ARCActionCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#E7DCC8] p-4 space-y-3 max-w-xl">
      
      <div className="text-sm font-semibold text-[#4A331D]">
        {action.title}
      </div>

      <div className="text-sm text-gray-700 leading-snug">
        {action.description}
      </div>

      <div className="text-xs text-gray-500">
        Why this matters: {reasoning}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-gray-600">
          Priority: {priority.level} ({priority.score}/100)
        </div>

        <div className="flex gap-2">
          <button className="px-3 py-1 text-xs rounded bg-[#C29A6B] text-white">
            Take step
          </button>
          <button className="px-3 py-1 text-xs rounded border border-[#C29A6B] text-[#C29A6B]">
            Break down
          </button>
        </div>
      </div>
    </div>
  );
}
