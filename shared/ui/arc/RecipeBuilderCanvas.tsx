"use client";

import { useState, useRef } from "react";

interface RecipeBuilderCanvasProps {
  onBack?: () => void;
  onOpenInspirationPicker?: () => void;
  onOpenUploadModal?: () => void;
  onOpenLibraryPicker?: () => void;
}

/**
 * RecipeBuilderCanvas — Standalone recipe creation workspace
 * 
 * Layout:
 * - Empty canvas center (no forms)
 * - Single large textarea: "Describe your recipe idea..."
 * - Optional attachment buttons
 * - Right-side chat remains available for support (not leading)
 * 
 * Flow:
 * - Chef types idea into main canvas
 * - Chef optionally attaches context
 * - No recipe persisted until explicit save
 */
export default function RecipeBuilderCanvas({
  onBack,
  onOpenInspirationPicker,
  onOpenUploadModal,
  onOpenLibraryPicker,
}: RecipeBuilderCanvasProps) {
  const [ideaText, setIdeaText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="h-full flex flex-col bg-[#FAF8F4]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0D4BF] bg-[#FBF4E8]">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="text-sm text-[#8B7E6A] hover:text-[#4A331D] transition"
            >
              ← Back
            </button>
          )}
          <h1 className="text-xl font-semibold text-[#2F2A25]">Recipe Builder</h1>
        </div>
        <div className="text-xs text-[#8B7E6A]">
          Draft — not saved yet
        </div>
      </div>

      {/* Main canvas */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-10">
          {/* Primary input area */}
          <div className="space-y-6">
            <div>
              <label className="text-xs uppercase tracking-wider text-[#8B7E6A] mb-3 block">
                Your Recipe Idea
              </label>
              <textarea
                ref={textareaRef}
                value={ideaText}
                onChange={(e) => setIdeaText(e.target.value)}
                placeholder="Describe your recipe idea, inspiration, or goal in your own words...

For example:
• A light summer salad with local greens and citrus dressing
• Something warming for a winter dinner party, maybe lamb-based
• A vegetarian main that can serve 40 guests
• Recreate grandma's chicken curry but make it restaurant-ready"
                className="w-full min-h-[300px] p-6 rounded-xl border border-[#E0D4BF] bg-white text-[#2F2A25] placeholder:text-[#B5A898] focus:outline-none focus:border-[#C5B8A5] focus:ring-2 focus:ring-[#C5B8A5]/20 resize-none transition"
                style={{
                  lineHeight: 1.7,
                  fontSize: "1rem",
                }}
              />
            </div>

            {/* Attachment options */}
            <div className="flex flex-wrap gap-3">
              {onOpenInspirationPicker && (
                <button
                  onClick={onOpenInspirationPicker}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E0D4BF] bg-white text-sm text-[#4A331D] hover:bg-[#F8F4EE] hover:border-[#C5B8A5] transition"
                >
                  <span>✨</span>
                  <span>Use inspiration recipe</span>
                </button>
              )}
              {onOpenUploadModal && (
                <button
                  onClick={onOpenUploadModal}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E0D4BF] bg-white text-sm text-[#4A331D] hover:bg-[#F8F4EE] hover:border-[#C5B8A5] transition"
                >
                  <span>📄</span>
                  <span>Upload recipe</span>
                </button>
              )}
              {onOpenLibraryPicker && (
                <button
                  onClick={onOpenLibraryPicker}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E0D4BF] bg-white text-sm text-[#4A331D] hover:bg-[#F8F4EE] hover:border-[#C5B8A5] transition"
                >
                  <span>📚</span>
                  <span>Attach from library</span>
                </button>
              )}
            </div>

            {/* Helper text */}
            <div className="pt-4 border-t border-[#E0D4BF]">
              <p className="text-sm text-[#8B7E6A] leading-relaxed">
                Start by describing what you want to create. You can attach inspiration recipes, 
                upload existing recipes, or pull from your library. ARC will help refine your idea 
                into a complete recipe when you&apos;re ready.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer with save action (when ready) */}
      {ideaText.trim().length > 0 && (
        <div className="px-6 py-4 border-t border-[#E0D4BF] bg-[#FBF4E8] flex justify-end">
          <button
            className="px-5 py-2.5 rounded-lg bg-[#2F2A25] text-white hover:bg-[#4A331D] transition text-sm font-medium"
            onClick={() => {
              // TODO: Save recipe draft
              console.log("Save recipe draft:", ideaText);
            }}
          >
            Save Draft
          </button>
        </div>
      )}
    </div>
  );
}

