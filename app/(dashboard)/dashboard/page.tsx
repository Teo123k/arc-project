"use client";

import { useEffect, useState } from "react";
import ARCChat from "@/shared/ui/arc/ARCChat";
import { extractFilesContent } from "@/app/lib/arc/fileExtraction";

type ARCState = {
  arcOutput: string | null;
  decision?: {
    summary: { title: string };
    decisionText: string;
    verdict: string;
    financials?: {
      totalCost: number | null;
      expectedRevenue: number | null;
      margin: number | null;
      costPerServing: number | null;
      breakEvenPrice: number | null;
    };
  };
};

const STORAGE_KEY = "arc.state";

type RecipeIntelligence = {
  lifecycleState?: 
    | "ingested"
    | "discovered"
    | "parsed"
    | "enriched"
    | "needs_clarification"
    | "user_confirmed"
    | "finalized";

  // Legacy flat fields (existing UI expects strings)
  recipeName?: string;
  dishCategory?: "starter" | "main" | "dessert" | "other";
  dishStyle?: string;
  cuisine?: string;
  dietary?: string[];

  // New structured fields (internal use)
  recipeNameStructured?: {
    value: string;
    confidence: number;
    source: "ocr" | "ai" | "user";
  };
  dishCategoryStructured?: {
    value: "starter" | "main" | "dessert" | "other";
    confidence: number;
  };
  dishStyleStructured?: { value: string; confidence: number };
  cuisineStructured?: { value: string; confidence: number };
  dietaryStructured?: { value: string[]; confidence: number };

  ingredients?: {
    name: string;
    quantity?: number;
    unit?: string;
    confidence?: number;
  }[];

  completeness?: {
    chefUsable: boolean;
    costingReady: boolean;
  };

  clarificationQuestions?: {
    id: string;
    field: string;
    question: string;
    options?: string[];
    priority: number;
    status: "open" | "answered" | "skipped";
  }[];

  source?: "ocr" | "ai" | "user";
};

type UploadedFile = {
  role: 'recipe' | 'invoice' | 'event' | 'note';
  name: string;
  type: string;
  size: number;
  extractedText?: string | null;
  extractionMethod?: "text" | "ocr" | "unsupported";
  extractionError?: string | null;
  file?: File;

  // Step C — AI-enriched recipe data
  recipeIntelligence?: RecipeIntelligence;
};

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [arcState, setArcState] = useState<ARCState>({
    arcOutput: null,
  });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [extractingFiles, setExtractingFiles] = useState(false);
  const [canvasTab, setCanvasTab] = useState<
    "verdict" | "financials" | "operations" | "risks" | "next"
  >("verdict");
  // UI-only view state (does NOT affect OCR or logic)
  const [currentView, setCurrentView] = useState<
    "home" | "library" | "new-project"
  >("new-project");
  const [showChat, setShowChat] = useState(true);
  // Library internal routing (UI only)
  const [libraryTab, setLibraryTab] = useState<"recipes" | "invoices">("recipes");

  const [activeRecipeReview, setActiveRecipeReview] =
    useState<UploadedFile | null>(null);

  // ✅ Prevent server/client mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-open review modal for the first recipe file that still needs review
  useEffect(() => {
    if (activeRecipeReview) return;
    const nextRecipeToReview = uploadedFiles.find((file) => {
      if (file.role !== "recipe") return false;

      const intel = file.recipeIntelligence;
      if (!intel) return false;

      // Only interrupt the user if the recipe is NOT chef-usable
      // Auto-named, usable recipes should flow straight into the library
      if (intel.completeness?.chefUsable === true) return false;

      // Early discovery state still needs human attention
      if (intel.lifecycleState === "discovered") return true;

      return false;
    });

    if (nextRecipeToReview) {
      setActiveRecipeReview(nextRecipeToReview);
    }
  }, [uploadedFiles, activeRecipeReview]);

  // Load persisted state (client-only)
  useEffect(() => {
    if (!mounted) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setArcState(JSON.parse(saved));
      } catch {}
    }
  }, [mounted]);

  // Persist state
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arcState));
  }, [mounted, arcState]);

  const triggerRoleUpload = async (role: UploadedFile["role"]) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/*,.pdf,.txt,.md";

    input.onchange = async () => {
      if (!input.files || input.files.length === 0) return;

      const files = Array.from(input.files);
      setExtractingFiles(true);

      const newFiles: UploadedFile[] = [];

      for (const file of files) {
        // Text files: extract locally
        if (file.type === "text/plain" || file.name.endsWith(".md")) {
          try {
            const text = await file.text();
            newFiles.push({
              name: file.name,
              type: file.type,
              size: file.size,
              role,
              extractedText: text,
              extractionMethod: "text",
              recipeIntelligence:
                role === "recipe"
                  ? {
                      needsReview: true,
                      confidence: "low",
                      source: "text",
                    }
                  : undefined,
            });
          } catch {
            newFiles.push({
              name: file.name,
              type: file.type,
              size: file.size,
              role,
              extractedText: null,
              extractionMethod: "text",
              extractionError: "Failed to read text file",
              recipeIntelligence:
                role === "recipe"
                  ? {
                      needsReview: true,
                      confidence: "low",
                      source: "text",
                    }
                  : undefined,
            });
          }
          continue;
        }

        // Images / PDFs: OCR via API
        try {
          const formData = new FormData();
          formData.append("role", role);
          formData.append("files", file);

          const res = await fetch("/api/arc/ocr", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          const result = data.files?.[0];

          newFiles.push({
            name: file.name,
            type: file.type,
            size: file.size,
            role,
            extractedText: result?.extractedText ?? null,
            extractionMethod: "ocr",
            extractionError: result?.error ?? null,

            // ✅ AUTHORITATIVE chef intelligence seed
            recipeIntelligence:
              role === "recipe"
                ? {
                    needsReview: true,
                    confidence: "low",
                    source: "ocr",
                  }
                : undefined,
          });
        } catch (err: any) {
          newFiles.push({
            name: file.name,
            type: file.type,
            size: file.size,
            role,
            extractedText: null,
            extractionMethod: "ocr",
            extractionError: err?.message ?? "OCR request failed",
            recipeIntelligence:
              role === "recipe"
                ? {
                    needsReview: true,
                    confidence: "low",
                    source: "ocr",
                  }
                : undefined,
          });
        }
      }

      setUploadedFiles((prev) => [...prev, ...newFiles]);
      setExtractingFiles(false);
    };

    input.click();
  };

  // 🔑 CRITICAL: render nothing on server
  if (!mounted) return null;

  return (
    <div className="w-full h-screen flex bg-[#F8F1E6]">
      {/* LEFT CANVAS */}
      <div className="flex-1 p-6">
        <div className="flex h-full">
          {/* LEFT RAIL */}
          <aside
            data-canvas="canvas-tools"
            className="w-[220px] shrink-0 px-3 py-4 text-sm text-[#4A331D] border-r border-[#E0D4BF]"
          >
            <div className="flex flex-col gap-3">
              {/* MENU */}
              <nav className="space-y-1">
                <button className="w-full text-left px-2 py-1 rounded hover:bg-[#EFE4D2]">
                  🔍 Search
                </button>
                <button
                  className="w-full text-left px-2 py-1 rounded hover:bg-[#EFE4D2]"
                  onClick={() => setCurrentView("home")}
                >
                  🏠 Home
                </button>
                <button
                  className="w-full text-left px-2 py-1 rounded hover:bg-[#EFE4D2]"
                  onClick={() => setCurrentView("library")}
                >
                  📚 Library
                </button>
                <button
                  className="w-full text-left px-2 py-1 rounded hover:bg-[#EFE4D2] font-medium"
                  onClick={() => setCurrentView("new-project")}
                >
                  ➕ New Project
                </button>
              </nav>

              {currentView === "library" && (
                <div className="mt-3 text-[11px] uppercase tracking-wide text-[#8B7E6A]">
                  Library uploads
                </div>
              )}

              {currentView === "new-project" && (
                <div className="mt-3 text-[11px] uppercase tracking-wide text-[#8B7E6A]">
                  Project context
                </div>
              )}

              {/* Library uploads */}
              {currentView === "library" && (
                <div className="pl-2 mt-2 space-y-1">
                  <button onClick={() => triggerRoleUpload("recipe")} className="block text-left text-xs hover:underline">
                    + Add Recipe
                  </button>
                  <button onClick={() => triggerRoleUpload("invoice")} className="block text-left text-xs hover:underline">
                    + Add Invoice
                  </button>
                </div>
              )}

              {/* New project uploads */}
              {currentView === "new-project" && (
                <div className="pl-2 mt-2 space-y-1">
                  <button onClick={() => triggerRoleUpload("event")} className="block text-left text-xs hover:underline">
                    + Add Event Brief
                  </button>
                  <button onClick={() => triggerRoleUpload("note")} className="block text-left text-xs hover:underline">
                    + Add Notes
                  </button>
                </div>
              )}

              {extractingFiles && (
                <p className="text-xs text-[#8B7E6A] mb-2">Extracting…</p>
              )}

              {/* FILE LIST */}
              {uploadedFiles.length > 0 && (
                <div className="mt-3 space-y-1 text-xs opacity-80">
                  {(['recipe','invoice','event','note'] as const).map((role) => {
                    const files = uploadedFiles.filter(f => f.role === role);
                    if (files.length === 0) return null;
                    return (
                      <div key={role} className="mb-2">
                        <div className="text-[10px] uppercase tracking-wider text-[#8B7E6A] mb-1">
                          {role}
                        </div>
                        {files.map((file) => (
                          <div key={file.name} className="text-xs text-[#6F6352]">
                            {file.name}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          {/* MAIN DOCUMENT */}
          <main
            data-canvas="canvas-main"
            className="flex-1 overflow-auto px-12 py-8"
          >
            <div className="max-w-[1100px]">
              {/* ===================== */}
              {/* LIBRARY CANVAS VIEW */}
              {/* ===================== */}
              {currentView === "library" && (
                <div className="space-y-10">
                  {/* Header */}
                  <div>
                    <h1 className="text-2xl font-semibold text-[#2F2A25]">
                      Library
                    </h1>
                    <p className="text-sm text-[#7A6F60] mt-1">
                      Your recipes and invoices — organized, reusable, and location-aware.
                    </p>
                  </div>

                  {/* Library internal tabs */}
                  <div className="flex gap-2 border-b pb-2 text-sm">
                    <button
                      onClick={() => setLibraryTab("recipes")}
                      className={`px-3 py-1 rounded-md ${
                        libraryTab === "recipes"
                          ? "bg-black text-white"
                          : "bg-gray-100 hover:bg-gray-200"
                      }`}
                    >
                      Recipes
                    </button>
                    <button
                      onClick={() => setLibraryTab("invoices")}
                      className={`px-3 py-1 rounded-md ${
                        libraryTab === "invoices"
                          ? "bg-black text-white"
                          : "bg-gray-100 hover:bg-gray-200"
                      }`}
                    >
                      Invoices
                    </button>
                  </div>

                  {/* Recipe Library */}
                  {libraryTab === "recipes" && (
                  <section className="space-y-4">
                    {/* Header */}
                    <div>
                      <h2 className="text-2xl font-semibold text-[#2F2A25]">
                        Recipe Library
                      </h2>
                      <p className="text-sm text-[#7A6F60] mt-1 max-w-[640px]">
                        Your working recipe book. Reusable dishes, organized the way chefs think —
                        by cuisine, occasion, and service style.
              </p>
            </div>

                    {/* Filters row (UI only, future-ready) */}
                    <div className="flex gap-2 flex-wrap opacity-80">
                      {["Cuisine", "Occasion", "Dietary", "Cost", "Service Style"].map((label) => (
                        <button
                          key={label}
                          className="px-3 py-1 rounded-full text-xs border border-[#E0D4BF] text-[#5C4A32] hover:bg-[#EFE4D2]"
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Recipe table */}
                    <div className="border border-[#E0D4BF] rounded-xl overflow-hidden bg-[#FBF4E8]">
                      <div className="grid grid-cols-[2fr,1fr,1fr,1fr] gap-2 px-4 py-2.5 text-[10px] uppercase tracking-wider text-[#8B7E6A] border-b border-[#E0D4BF] bg-[#FAF2E6]">
                        <div>Recipe</div>
                        <div>Cuisine</div>
                        <div>Occasion</div>
                        <div>Dietary</div>
                      </div>

                      {uploadedFiles.filter((f) => f.role === "recipe").length === 0 ? (
                        <div className="px-4 py-8 text-sm text-[#8B7E6A]">
                          No recipes yet. Add recipes to start building your working repertoire.
                        </div>
                      ) : (
                        <div className="divide-y divide-[#E0D4BF]">
                          {uploadedFiles
                            .filter((f) => f.role === "recipe")
                            .map((file) => (
                              <button
                                key={`${file.name}-${file.size}`}
                                className="w-full text-left grid grid-cols-[2fr,1fr,1fr,1fr] gap-2 px-4 py-3 transition hover:bg-[#F5ECDD] focus:outline-none"
                                onClick={() => setActiveRecipeReview(file)}
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate text-[#2F2A25]">
                                    {file.recipeIntelligence?.needsReview
                                      ? "Unidentified recipe"
                                      : (file.recipeIntelligence?.recipeName ?? file.name)}
                                  </div>
                                  <div className="text-[11px] text-[#8B7E6A]">
                                    {file.recipeIntelligence?.needsReview
                                      ? "Click to name this recipe"
                                      : (file.recipeIntelligence?.dishStyle ?? "Recipe document")}
                                  </div>
                                </div>
                                <div className="text-xs text-[#6F6352]">
                                  {file.recipeIntelligence?.cuisine ?? "—"}
                                </div>
                                <div className="text-xs text-[#6F6352]">
                                  {file.recipeIntelligence?.dishCategory ?? "—"}
                                </div>
                                <div className="text-xs text-[#6F6352]">
                                  {file.recipeIntelligence?.dietary?.join(", ") ?? "—"}
                                </div>
                              </button>
                            ))}
                        </div>
                      )}
            </div>
          </section>
                  )}

                  {/* Invoice Library */}
                  {libraryTab === "invoices" && (
                  <section className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-medium">🧾 Invoices</h2>
                        <p className="text-xs text-[#8B7E6A] mt-1">
                          Market pricing memory — organized by location and currency.
                        </p>
                      </div>
                    </div>

                    {/* Invoice ledger table */}
                    <div className="border border-[#E0D4BF] rounded-xl overflow-hidden bg-[#FBF4E8]">
                      <div className="grid grid-cols-[1.6fr,0.9fr,0.9fr,0.8fr,0.8fr] gap-2 px-4 py-2 text-[11px] uppercase tracking-wider text-[#8B7E6A] border-b border-[#E0D4BF]">
                        <div>Invoice</div>
                        <div>Country</div>
                        <div>City</div>
                        <div>Currency</div>
                        <div className="text-right">Date</div>
                      </div>

                      {uploadedFiles.filter((f) => f.role === "invoice").length === 0 ? (
                        <div className="px-4 py-6 text-sm text-[#8B7E6A]">
                          No invoices yet. Upload invoices to build market price memory.
                        </div>
                      ) : (
                        <div className="divide-y divide-[#E0D4BF]">
                          {uploadedFiles
                            .filter((f) => f.role === "invoice")
                            .map((file) => (
                              <button
                                key={file.name}
                                className="w-full text-left grid grid-cols-[1.6fr,0.9fr,0.9fr,0.8fr,0.8fr] gap-2 px-4 py-3 hover:bg-[#F5ECDD]"
                                onClick={() => {
                                  // UI-only placeholder for future invoice drill-down
                                }}
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate text-[#2F2A25]">
                                    {file.name}
                                  </div>
                                  <div className="text-xs text-[#8B7E6A]">
                                    Invoice file
                                  </div>
                                </div>
                                <div className="text-xs text-[#6F6352]">—</div>
                                <div className="text-xs text-[#6F6352]">—</div>
                                <div className="text-xs text-[#6F6352]">—</div>
                                <div className="text-xs text-[#6F6352] text-right">—</div>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </section>
                  )}
                </div>
              )}

              {currentView === "new-project" && (
                <div className="mb-4 flex gap-2 border-b pb-2 text-sm">
                  {[
                    ["verdict", "Verdict"],
                    ["financials", "Financials"],
                    ["operations", "Operations"],
                    ["risks", "Risks & Gaps"],
                    ["next", "Next Actions"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setCanvasTab(key as any)}
                      className={`px-3 py-1 rounded-md transition ${
                        canvasTab === key
                          ? "bg-black text-white"
                          : "bg-gray-100 hover:bg-gray-200"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {currentView === "new-project" && (
                <>
              {arcState.decision ? (
                <>
                  {canvasTab === "verdict" && (
                    <>
                      <h2 className="text-lg font-semibold mb-2">
                        Verdict: {arcState.decision.verdict}
                      </h2>
                      <pre className="whitespace-pre-wrap text-sm">
                        {arcState.decision.decisionText}
                      </pre>
                    </>
                  )}

                  {canvasTab === "financials" && arcState.decision.financials && (
                    <div className="text-sm space-y-2">
                      <div>Total Cost: {arcState.decision.financials.totalCost ?? "—"}</div>
                      <div>Revenue: {arcState.decision.financials.expectedRevenue ?? "—"}</div>
                      <div>Margin: {arcState.decision.financials.margin ?? "—"}%</div>
                      <div>
                        Cost / Serving: {arcState.decision.financials.costPerServing ?? "—"}
                      </div>
                      <div>
                        Break-even Price:{" "}
                        {arcState.decision.financials.breakEvenPrice ?? "—"}
                      </div>
                    </div>
                  )}

                  {canvasTab === "operations" && (
                    <div className="text-sm text-muted-foreground">
                      Operational steps will appear here.
                    </div>
                  )}

                  {canvasTab === "risks" && (
                    <div className="text-sm text-muted-foreground">
                      Risks & gaps will appear here.
                    </div>
                  )}

                  {canvasTab === "next" && (
                    <div className="text-sm text-muted-foreground">
                      Next actions will appear here.
                    </div>
                  )}
                </>
              ) : arcState.arcOutput ? (
                <pre className="whitespace-pre-wrap text-sm">
                  {arcState.arcOutput}
                </pre>
              ) : (
                <div className="text-muted-foreground text-sm">
                  Waiting for ARC output…
                </div>
              )}
                </>
              )}
            </div>
          </main>
        </div>
      </div>

      {!showChat && (
        <button
          onClick={() => setShowChat(true)}
          className="fixed right-2 top-1/2 z-50 bg-[#EADDC7] text-[11px] px-3 py-1 rounded-full shadow"
        >
          Show Chat
        </button>
      )}

      {/* RIGHT SIDEBAR */}
      {showChat && (
        <div className="fixed bottom-4 right-4 w-[280px] h-[50vh] rounded-xl border border-[#E0D4BF] bg-[#F3E6D3] p-3 flex flex-col shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[13px] font-semibold" style={{ color: "#4A331D" }}>
          ARC — Conversation
        </h2>
            <button
              onClick={() => setShowChat(false)}
              className="text-[11px] text-[#8A6A3A] hover:underline"
            >
              Hide
            </button>
          </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <ARCChat
              uploadedFiles={uploadedFiles}
              setUploadedFiles={setUploadedFiles}
              arcState={arcState}
              setArcState={setArcState}
          />
        </div>
      </div>
      )}

      {activeRecipeReview && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white w-[520px] rounded-xl p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-semibold">
              Confirm Recipe
            </h3>

            <input
              className="w-full border rounded px-3 py-2 text-sm"
              value={activeRecipeReview.recipeIntelligence?.recipeName || ""}
              onChange={(e) =>
                setActiveRecipeReview((prev) =>
                  prev
                    ? ({
                        ...prev,
                        recipeIntelligence: {
                          ...(prev.recipeIntelligence ?? {}),
                          recipeName: e.target.value,
                        },
                      } as UploadedFile)
                    : prev
                )
              }
              placeholder="Recipe name"
            />

            <div className="flex gap-2 text-xs">
              <span>Category:</span>
              {["starter", "main", "dessert", "other"].map((c) => (
                <button
                  key={c}
                  className={`px-2 py-1 rounded border ${
                    activeRecipeReview.recipeIntelligence?.dishCategory === c ? "bg-black text-white" : ""
                  }`}
                  onClick={() =>
                    setActiveRecipeReview((prev) =>
                      prev
                        ? ({
                            ...prev,
                            recipeIntelligence: {
                              ...(prev.recipeIntelligence ?? {}),
                              dishCategory: c as any,
                            },
                          } as UploadedFile)
                        : prev
                    )
                  }
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                className="text-sm px-3 py-1 border rounded"
                onClick={() => setActiveRecipeReview(null)}
              >
                Skip
              </button>
              <button
                className="text-sm px-3 py-1 bg-black text-white rounded"
                onClick={() => {
                  const name = activeRecipeReview.name;
                  const size = activeRecipeReview.size;
                  const nextIntelligence = {
                    ...(activeRecipeReview.recipeIntelligence ?? {}),
                    needsReview: false,
                    confidence: "high" as const,
                    source: "chef",
                  };

                  setUploadedFiles((prev) =>
                    prev.map((f) =>
                      f.name === name && f.size === size
                        ? {
                            ...f,
                            recipeIntelligence: {
                              // Merge with the latest intelligence on the file to avoid wiping AI fields
                              ...(f.recipeIntelligence ?? {}),
                              ...(nextIntelligence ?? {}),
                            },
                          }
                        : f
                    )
                  );

                  setActiveRecipeReview(null);
                }}
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}