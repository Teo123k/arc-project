interface ActionStreamProps {
  actions: any[];
}

export default function ActionStream({ actions }: ActionStreamProps) {
  if (!actions || actions.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        Talk to ARC on the right. When a next step is found, it will appear here.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {actions.map((result, index) => {
        const { action, priority, intention, friction } = result ?? {};

        return (
          <div
            key={index}
            style={{
              animationDelay: `${index * 0.06}s`, // ⭐ Stagger timing
            }}
            className="
              max-w-[520px]
              bg-[#FCF7F0]
              border border-[#E2D3B2]
              rounded-xl p-5 shadow-sm
              animate-arc-entry
              opacity-0
            "
          >
            {/* Header */}
            <div className="text-xs uppercase tracking-wide text-[#9A7B4C] mb-1">
              Next Step
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold text-[#4A331D] leading-snug">
              {action?.title ?? "Next step"}
            </h3>

            {/* Description */}
            {action?.description && (
              <p className="text-sm text-[#5A4630] mt-2 leading-relaxed">
                {action.description}
              </p>
            )}

            {/* Intention / Friction */}
            {(intention || friction) && (
              <p className="text-[11px] text-[#8A7453] mt-3">
                Intention:
                <span className="font-medium"> {intention}</span>
                {friction && (
                  <>
                    {" · "}
                    Friction:
                    <span className="font-medium"> {friction}</span>
                  </>
                )}
              </p>
            )}

            {/* Priority */}
            {priority && (
              <div className="mt-4 inline-flex items-center rounded-full bg-[#F1E2C7] px-3 py-1 text-[11px] text-[#6C5432]">
                Priority: {priority.level} ({priority.score}/100)
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
