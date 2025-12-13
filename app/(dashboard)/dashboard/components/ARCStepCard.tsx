"use client";

interface ARCStepCardProps {
  result: any;
}

export default function ARCStepCard({ result }: ARCStepCardProps) {
  if (!result) return null;

  const { action, priority } = result;

  return (
    <div className="rounded-xl p-5 shadow-md bg-white border border-[#E2D6C4] w-full">
      <h3 className="font-semibold text-sm text-[#4A331D] mb-3 tracking-wide">
        🧭 CLEAR NEXT STEP
      </h3>

      <div className="space-y-1 mb-4">
        <p className="text-base font-medium text-[#3A2412]">
          🎯 {action.title}
        </p>

        <p className="text-sm text-gray-600">
          {action.description}
        </p>

        <p className="text-xs mt-2 text-[#7A5F3C]">
          🔥 Priority: {priority.level} ({priority.score})
        </p>
      </div>

      <button
        className="w-full bg-[#4A331D] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#5C4025] transition"
        onClick={() => console.log("Trigger future n8n automation")}
      >
        TAKE ACTION
      </button>
    </div>
  );
}