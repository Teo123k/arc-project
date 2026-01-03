"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CanonicalRecipe } from "@/app/lib/arc/recipe/resolveCanonicalRecipe";
import { computePortionsAndScale, formatScaledQuantity } from "@/app/lib/core/recipes/scaleIngredients";

type Course = "starter" | "main" | "dessert" | "other";

type UploadedFileLike = {
  id: string;
  name: string;
  type?: string;
  extractionMethod?: "text" | "ocr" | "csv" | "unsupported";
  recipeFolderId?: string | null;
  canonicalRecipe?: CanonicalRecipe;
  recipeIntelligence?: {
    cuisine?: string;
    dishCategory?: Course;
    dietary?: string[];
    dietaryStructured?: { value: string[]; confidence: number };
    recipeName?: string;
  };
};

type Props = {
  file: UploadedFileLike | null;
  onHide: () => void;
  onUpdate: (next: UploadedFileLike) => void;
  onCreateMyRecipeFromThis?: (sourceId: string) => void;
};

function clampCourse(value: string): Course {
  if (value === "starter" || value === "main" || value === "dessert") return value;
  return "other";
}

type IngredientCategory = "fresh" | "dry" | "other";

function inferIngredientCategory(name: string): IngredientCategory {
  const lower = name.toLowerCase();
  // Fresh: produce, meat, fish, dairy, herbs
  if (/\b(chicken|beef|pork|lamb|fish|salmon|tuna|shrimp|prawn|egg|milk|cream|butter|cheese|yogurt|tofu|tomato|onion|garlic|ginger|carrot|celery|pepper|lettuce|spinach|cabbage|broccoli|mushroom|apple|lemon|lime|orange|banana|berry|herb|basil|cilantro|parsley|mint|thyme|rosemary|dill|chive|scallion)\b/i.test(lower)) {
    return "fresh";
  }
  // Dry: flour, sugar, spices, grains, dried goods, oils, vinegars, sauces, canned
  if (/\b(flour|sugar|salt|pepper|spice|cumin|paprika|cinnamon|turmeric|curry|chili|rice|pasta|noodle|bread|oil|vinegar|soy sauce|sauce|stock|broth|water|wine|honey|syrup|jam|can|dried|powder|baking)\b/i.test(lower)) {
    return "dry";
  }
  return "other";
}

const CATEGORY_ORDER: IngredientCategory[] = ["fresh", "dry", "other"];
const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  fresh: "Fresh",
  dry: "Dry",
  other: "Other",
};

const MAX_HISTORY = 10;

export function RecipeFrame({ file, onHide, onUpdate }: Props) {
  const [touchedAt, setTouchedAt] = useState<number>(Date.now());
  const [page, setPage] = useState(0);
  const [editingIngredientIdx, setEditingIngredientIdx] = useState<number | null>(null);
  const [editingStepIdx, setEditingStepIdx] = useState<number | null>(null);
  const [targetPortions, setTargetPortions] = useState<number | null>(null);
  const [portionInput, setPortionInput] = useState<string>("");

  // Undo history stack
  const historyRef = useRef<CanonicalRecipe[]>([]);

  const recipe = file?.canonicalRecipe;
  const isInspiration = file?.recipeFolderId === "__inspiration__";

  // Fix dietary display - check both sources
  const dietaryText = useMemo(() => {
    const list =
      file?.recipeIntelligence?.dietary ??
      file?.recipeIntelligence?.dietaryStructured?.value ??
      [];
    return list.join(", ");
  }, [file]);

  // Reset paging + edits when switching recipes (must be before early return)
  useEffect(() => {
    if (!file?.id) return;
    setPage(0);
    setEditingIngredientIdx(null);
    setEditingStepIdx(null);
    setTargetPortions(null);
    historyRef.current = [];
    // Initialize portion input from recipe
    const base = file?.canonicalRecipe?.servings?.value;
    setPortionInput(base != null ? String(base) : "1");
  }, [file?.id, file?.canonicalRecipe?.servings?.value]);

  // Early return AFTER all hooks
  if (!file || !recipe) {
    return (
      <div className="p-4 text-sm text-[#7A6F60]">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wide text-[#8B7E6A]">
            Recipe
          </div>
          <button
            onClick={onHide}
            className="text-[11px] px-2 py-1 rounded-md border border-[#E0D4BF] hover:bg-[#F5ECDD]"
          >
            Hide
          </button>
        </div>
        <div className="mt-3">Select a recipe to view.</div>
      </div>
    );
  }

  const update = (nextRecipe: CanonicalRecipe, nextMeta?: Partial<UploadedFileLike["recipeIntelligence"]>) => {
    // Push current recipe to history before updating
    if (recipe) {
      historyRef.current = [recipe, ...historyRef.current].slice(0, MAX_HISTORY);
    }
    const nextFile: UploadedFileLike = {
      ...file,
      canonicalRecipe: nextRecipe,
      recipeIntelligence: {
        ...(file.recipeIntelligence ?? {}),
        recipeName: nextRecipe.title,
        cuisine: nextRecipe.cuisine?.value,
        dishCategory: (nextRecipe.occasion?.value as any) ?? file.recipeIntelligence?.dishCategory,
        ...(nextMeta ?? {}),
      },
    };
    setTouchedAt(Date.now());
    onUpdate(nextFile);
  };

  const undo = useCallback(() => {
    if (historyRef.current.length === 0 || !file) return;
    const [prev, ...rest] = historyRef.current;
    historyRef.current = rest;
    const nextFile: UploadedFileLike = {
      ...file,
      canonicalRecipe: prev,
      recipeIntelligence: {
        ...(file.recipeIntelligence ?? {}),
        recipeName: prev.title,
        cuisine: prev.cuisine?.value,
        dishCategory: (prev.occasion?.value as any) ?? file.recipeIntelligence?.dishCategory,
      },
    };
    setTouchedAt(Date.now());
    onUpdate(nextFile);
  }, [file, onUpdate]);

  const setTitle = (title: string) => update({ ...recipe, title });
  const baseServings = recipe.servings.value ?? null;
  const { portions, scale } = computePortionsAndScale({ baseServings, targetPortions });

  const setCuisine = (value: string) => {
    const trimmed = value.trim();
    update({
      ...recipe,
      cuisine: trimmed
        ? { value: trimmed, confidence: 1 }
        : undefined,
      provenance: {
        ...recipe.provenance,
        sources: Array.from(new Set([...(recipe.provenance?.sources ?? []), "user"])),
      },
    });
  };

  const setCourse = (course: Course) => {
    update({
      ...recipe,
      occasion: course
        ? { value: course, confidence: 1 }
        : undefined,
      provenance: {
        ...recipe.provenance,
        sources: Array.from(new Set([...(recipe.provenance?.sources ?? []), "user"])),
      },
    });
  };

  const setDietary = (text: string) => {
    const tokens = text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    update(recipe, { dietary: tokens });
  };

  const setIngredient = (idx: number, patch: Partial<CanonicalRecipe["ingredients"][number]>) => {
    const nextIngredients = recipe.ingredients.map((ing, i) => {
      if (i !== idx) return ing;
      const updated = { ...ing, ...patch };
      // Auto-update category when name changes
      if ("name" in patch && patch.name) {
        updated.category = inferIngredientCategory(patch.name);
      }
      return updated;
    });
    update({ ...recipe, ingredients: nextIngredients });
  };

  const addIngredient = () => {
    const next = {
      ...recipe,
      ingredients: [
        ...recipe.ingredients,
        { name: "", quantity: null, unit: null, category: "other" as IngredientCategory },
      ],
    };
    update(next);
    setEditingIngredientIdx(next.ingredients.length - 1);
  };

  const removeIngredient = (idx: number) => {
    update({ ...recipe, ingredients: recipe.ingredients.filter((_, i) => i !== idx) });
    if (editingIngredientIdx === idx) setEditingIngredientIdx(null);
  };

  const setStep = (idx: number, instruction: string) => {
    const nextSteps = recipe.steps.map((s, i) =>
      i === idx ? { ...s, instruction } : s
    );
    update({ ...recipe, steps: nextSteps });
  };

  const addStep = () => {
    const nextOrder = (recipe.steps[recipe.steps.length - 1]?.order ?? 0) + 1;
    const next = {
      ...recipe,
      steps: [...recipe.steps, { order: nextOrder, instruction: "" }],
    };
    update(next);
    setEditingStepIdx(next.steps.length - 1);
  };

  const removeStep = (idx: number) => {
    const kept = recipe.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 }));
    update({ ...recipe, steps: kept });
    if (editingStepIdx === idx) setEditingStepIdx(null);
  };

  const ING_PER_PAGE = 14;
  const STEP_PER_PAGE = 8;

  const ingredientPageCount = Math.max(1, Math.ceil(recipe.ingredients.length / ING_PER_PAGE));
  const stepPageCount = Math.max(1, Math.ceil(recipe.steps.length / STEP_PER_PAGE));
  const hasAllergensPage = true;
  const totalPages = ingredientPageCount + stepPageCount + (hasAllergensPage ? 1 : 0);
  const safePage = Math.max(0, Math.min(page, totalPages - 1));

  const isIngredientsPage = safePage < ingredientPageCount;
  const ingredientPageIndex = isIngredientsPage ? safePage : 0;
  const isStepsPage =
    safePage >= ingredientPageCount &&
    safePage < ingredientPageCount + stepPageCount;
  const stepPageIndex = isStepsPage ? safePage - ingredientPageCount : 0;
  const isAllergensPage = safePage === ingredientPageCount + stepPageCount;

  const stepStart = stepPageIndex * STEP_PER_PAGE;

  // Sort ingredients by category (fresh first, then dry, then other)
  const sortedIngredientsWithIdx = useMemo(() => {
    return recipe.ingredients
      .map((ing, idx) => ({ ing, idx }))
      .sort((a, b) => {
        const catA = a.ing.category ?? "other";
        const catB = b.ing.category ?? "other";
        return CATEGORY_ORDER.indexOf(catA) - CATEGORY_ORDER.indexOf(catB);
      });
  }, [recipe.ingredients]);

  const ingStart = ingredientPageIndex * ING_PER_PAGE;
  const visibleIngredientsWithIdx = sortedIngredientsWithIdx.slice(ingStart, ingStart + ING_PER_PAGE);
  const visibleSteps = recipe.steps.slice(stepStart, stepStart + STEP_PER_PAGE);

  // Page section label for indicator
  const pageSectionLabel = isIngredientsPage
    ? `Ingredients${ingredientPageCount > 1 ? ` ${ingredientPageIndex + 1}/${ingredientPageCount}` : ""}`
    : isStepsPage
    ? `Steps${stepPageCount > 1 ? ` ${stepPageIndex + 1}/${stepPageCount}` : ""}`
    : "Allergens";

  const goPrev = useCallback(() => setPage((p) => Math.max(0, p - 1)), []);
  const goNext = useCallback(() => setPage((p) => Math.min(totalPages - 1, p + 1)), [totalPages]);

  // Keyboard navigation: arrow keys to navigate pages
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea/select
      const tag = (e.target as Element)?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goPrev, goNext]);

  const allergens = useMemo(() => {
    const names = recipe.ingredients.map((i) => i.name.toLowerCase());
    const found = new Set<string>();
    const addIf = (label: string, rx: RegExp) => {
      if (names.some((n) => rx.test(n))) found.add(label);
    };
    addIf("gluten", /\b(wheat|flour|bread|pasta|noodle|soy sauce)\b/i);
    addIf("soy", /\b(soy|tofu|miso|edamame|soy sauce)\b/i);
    addIf("dairy", /\b(milk|cream|butter|cheese|yogurt|ghee)\b/i);
    addIf("egg", /\b(egg|eggs)\b/i);
    addIf("peanut", /\b(peanut)\b/i);
    addIf("tree nuts", /\b(almond|cashew|walnut|pistachio|hazelnut)\b/i);
    addIf("sesame", /\b(sesame|tahini)\b/i);
    addIf("fish", /\b(fish|salmon|tuna|anchovy)\b/i);
    addIf("shellfish", /\b(shrimp|prawn|crab|lobster)\b/i);
    return Array.from(found);
  }, [recipe.ingredients]);

  const formatQty = (q: number | null, u: string | null) => {
    return formatScaledQuantity(q, u, scale);
  };

  return (
    <div className="h-full min-h-[620px] overflow-hidden">
      <div className="h-full bg-[#FBF4E8] overflow-hidden flex flex-col">
        {/* Header - title + controls on same row */}
        <div className="px-4 py-2 border-b border-[#E0D4BF] bg-[#FAF2E6]">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <input
                className="flex-1 min-w-0 bg-transparent text-[15px] font-semibold text-[#2F2A25] outline-none"
                value={recipe.title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Recipe title"
              />
              {isInspiration && (
                <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border border-[#E0D4BF] bg-white/60 text-[#6F6352]">
                  Inspiration
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={goPrev}
                disabled={safePage <= 0}
                className="text-[11px] h-6 w-6 rounded border border-[#C5B8A5] bg-white text-[#3D2E1F] hover:bg-[#F5ECDD] disabled:opacity-40 flex items-center justify-center"
                aria-label="Previous"
              >
                ◀
              </button>
              <button
                onClick={goNext}
                disabled={safePage >= totalPages - 1}
                className="text-[11px] h-6 w-6 rounded border border-[#C5B8A5] bg-white text-[#3D2E1F] hover:bg-[#F5ECDD] disabled:opacity-40 flex items-center justify-center"
                aria-label="Next"
              >
                ▶
              </button>
              {isInspiration && (
                <button
                  onClick={() => {
                    if (!file) return;
                    onCreateMyRecipeFromThis?.(file.id);
                  }}
                  className="text-[11px] h-6 px-2 rounded border border-[#C5B8A5] bg-[#E8DFD0] text-[#3D2E1F] hover:bg-[#DED4C3] ml-2"
                  title="Duplicate this inspiration recipe into My Recipes"
                >
                  Create My Recipe from This
                </button>
              )}
              <button
                onClick={onHide}
                className="text-[11px] h-6 px-2 rounded border border-[#C5B8A5] bg-white text-[#3D2E1F] hover:bg-[#F5ECDD] ml-2"
              >
                Hide
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#8B7E6A]">Cuisine</span>
              <input
                className="px-2 py-1 rounded-md border border-[#E0D4BF] bg-white/70 outline-none w-[100px]"
                value={recipe.cuisine?.value ?? ""}
                onChange={(e) => setCuisine(e.target.value)}
                placeholder="e.g. Korean"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#8B7E6A]">Course</span>
              <select
                className="px-2 py-1 rounded-md border border-[#E0D4BF] bg-white/70 outline-none"
                value={clampCourse(String(recipe.occasion?.value ?? "other"))}
                onChange={(e) => setCourse(clampCourse(e.target.value))}
              >
                <option value="starter">starter</option>
                <option value="main">main</option>
                <option value="dessert">dessert</option>
                <option value="other">other</option>
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#8B7E6A]">Dietary</span>
              <input
                className="px-2 py-1 rounded-md border border-[#E0D4BF] bg-white/70 outline-none w-[120px]"
                value={dietaryText}
                onChange={(e) => setDietary(e.target.value)}
                placeholder="comma separated"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#8B7E6A]">Serves</span>
              <input
                className="px-2 py-1 rounded-md border border-[#E0D4BF] bg-white/70 outline-none w-[50px] text-center"
                value={portionInput}
                onChange={(e) => setPortionInput(e.target.value)}
                onBlur={() => {
                  const v = Number(portionInput);
                  if (Number.isFinite(v) && v > 0) {
                    setTargetPortions(v);
                    setPortionInput(String(v));
                  } else {
                    // Reset to current portions on invalid input
                    setPortionInput(String(portions));
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                inputMode="numeric"
              />
            </div>
          </div>
        </div>

        {/* Body - click to exit edit mode */}
        <div
          className="flex-1 min-h-0 overflow-hidden p-3"
          onClick={() => {
            setEditingIngredientIdx(null);
            setEditingStepIdx(null);
          }}
        >
          {/* Page content */}
          <div className="h-full rounded-xl border border-[#E0D4BF] bg-white/60 overflow-hidden">
            {isAllergensPage ? (
              <div className="h-full flex flex-col">
                <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-[#8B7E6A] bg-white/70">
                  Allergens
                </div>
                <div className="flex-1 min-h-0 p-3">
                  {allergens.length === 0 ? (
                    <div className="text-sm text-[#7A6F60]">No allergens detected.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {allergens.map((a) => (
                        <span
                          key={a}
                          className="text-xs px-2 py-1 rounded-full border border-[#E0D4BF] bg-white/70 text-[#2F2A25]"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 text-[11px] text-[#8B7E6A]">
                    Derived from ingredient names. Edit ingredients to update.
                  </div>
                </div>
              </div>
            ) : isIngredientsPage ? (
              <div className="h-full flex flex-col">
                <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-[#8B7E6A] bg-white/70 flex items-center justify-between">
                  <span>
                    {isInspiration
                      ? "Extracted ingredients (review recommended)"
                      : "Ingredients"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={undo}
                      disabled={historyRef.current.length === 0}
                      className="text-[11px] px-2 py-1 rounded-md border border-[#E0D4BF] bg-white/60 hover:bg-[#F5ECDD] disabled:opacity-40"
                    >
                      Undo
                    </button>
                    <button
                      onClick={() => {
                        setEditingStepIdx(null);
                        addIngredient();
                      }}
                      className="text-[11px] px-2 py-1 rounded-md border border-[#E0D4BF] bg-white/60 hover:bg-[#F5ECDD]"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 divide-y divide-[#E0D4BF] overflow-y-auto">
                  {recipe.ingredients.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-[#7A6F60]">No ingredients yet.</div>
                  ) : (
                    visibleIngredientsWithIdx.map(({ ing, idx }, localIdx) => {
                      const isEditing = editingIngredientIdx === idx;
                      const inferred =
                        Boolean((ing as any).quantityInferred) || Boolean((ing as any).unitInferred);
                      const category = ing.category ?? "other";
                      // Show section header if this is the first of its category in the visible list
                      const prevCategory = localIdx > 0 ? (visibleIngredientsWithIdx[localIdx - 1]?.ing.category ?? "other") : null;
                      const showHeader = localIdx === 0 || category !== prevCategory;
                      return (
                        <React.Fragment key={idx}>
                          {showHeader && (
                            <div className="px-3 py-1.5 bg-[#F5ECDD] text-[10px] uppercase tracking-wider text-[#8B7E6A] font-medium">
                              {CATEGORY_LABELS[category]}
                            </div>
                          )}
                          <div
                            className={`group relative px-3 py-2 ${inferred ? "bg-amber-50/60" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingStepIdx(null);
                              setEditingIngredientIdx(idx);
                            }}
                          >
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <input
                                  className="text-sm bg-white/80 border border-[#E0D4BF] rounded px-2 py-1 flex-1 outline-none"
                                  value={ing.name}
                                  onChange={(e) => setIngredient(idx, { name: e.target.value })}
                                  placeholder="Ingredient name"
                                />
                                <input
                                  className="text-sm bg-white/80 border border-[#E0D4BF] rounded px-2 py-1 w-[50px] outline-none text-center"
                                  value={ing.quantity ?? ""}
                                  onChange={(e) =>
                                    setIngredient(idx, {
                                      quantity: e.target.value === "" ? null : Number(e.target.value),
                                    })
                                  }
                                  placeholder="Qty"
                                />
                                <input
                                  className="text-sm bg-white/80 border border-[#E0D4BF] rounded px-2 py-1 w-[45px] outline-none text-center"
                                  value={ing.unit ?? ""}
                                  onChange={(e) => setIngredient(idx, { unit: e.target.value || null })}
                                  placeholder="Unit"
                                />
                                <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeIngredient(idx);
                                }}
                                className="h-6 w-6 rounded border border-[#C5B8A5] bg-[#E8DFD0] text-[#5C4A32] text-xs hover:bg-[#D9CCBA] flex items-center justify-center shrink-0"
                                aria-label="Delete"
                                title="Delete"
                              >
                                ×
                              </button>
                            </div>
                            ) : (
                              <div className="flex items-baseline justify-between gap-4">
                                <span className="text-sm text-[#2F2A25] flex-1 truncate">
                                  {ing.name || <span className="text-[#8B7E6A]">Click to edit</span>}
                                </span>
                                <span
                                  className={`text-sm font-medium shrink-0 tabular-nums text-right min-w-[80px] px-2 py-0.5 rounded ${
                                    inferred ? "bg-amber-100 text-amber-800" : "bg-[#F5ECDD] text-[#2F2A25]"
                                  }`}
                                >
                                  {formatQty(ing.quantity ?? null, ing.unit ?? null)}
                                </span>
                              </div>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })
                  )}
                </div>
              </div>
            ) : isStepsPage ? (
              <div className="h-full flex flex-col">
                <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-[#8B7E6A] bg-white/70 flex items-center justify-between">
                  <span>
                    {isInspiration ? "Steps detected — formatting may vary" : "Steps"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={undo}
                      disabled={historyRef.current.length === 0}
                      className="text-[11px] px-2 py-1 rounded-md border border-[#E0D4BF] bg-white/60 hover:bg-[#F5ECDD] disabled:opacity-40"
                    >
                      Undo
                    </button>
                    <button
                      onClick={() => {
                        setEditingIngredientIdx(null);
                        addStep();
                      }}
                      className="text-[11px] px-2 py-1 rounded-md border border-[#E0D4BF] bg-white/60 hover:bg-[#F5ECDD]"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 divide-y divide-[#E0D4BF] overflow-hidden">
                  {recipe.steps.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-[#7A6F60]">No steps yet.</div>
                  ) : (
                    visibleSteps.map((s, localIdx) => {
                      const idx = stepStart + localIdx;
                      const isEditing = editingStepIdx === idx;
                      return (
                        <div
                          key={s.order}
                          className="group relative px-3 py-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingIngredientIdx(null);
                            setEditingStepIdx(idx);
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] text-[#8B7E6A] mb-1">Step {idx + 1}</div>
                              {isEditing ? (
                                <textarea
                                  className="w-full min-h-[54px] text-sm bg-white/80 border border-[#E0D4BF] rounded px-2 py-1 outline-none"
                                  value={s.instruction}
                                  onChange={(e) => setStep(idx, e.target.value)}
                                  placeholder="Step instruction"
                                />
                              ) : (
                                <div className="text-sm text-[#2F2A25] leading-relaxed">
                                  {s.instruction?.trim() ? (
                                    s.instruction
                                  ) : (
                                    <span className="text-[#8B7E6A]">Click to edit</span>
                                  )}
                                </div>
                              )}
                            </div>
                            {isEditing && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeStep(idx);
                                }}
                                className="h-6 w-6 rounded border border-[#C5B8A5] bg-[#E8DFD0] text-[#5C4A32] text-xs hover:bg-[#D9CCBA] flex items-center justify-center shrink-0 mt-5"
                                aria-label="Delete"
                                title="Delete"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}


