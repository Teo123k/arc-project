"use client";

import { useState, useMemo } from "react";
import { ShoppingListItem } from "@/app/lib/core/shared/types";

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

type CourseType = "starter" | "main" | "dessert" | "side" | "beverage";

type EventMenuCourse = {
  id: string;
  type: CourseType;
  recipeIds: string[];
  // Portion count per recipe (recipeId -> portion multiplier)
  portions?: Record<string, number>;
};

type EventMenu = {
  courses: EventMenuCourse[];
  guestCount: number;
  prepTimeEstimate?: number;
  // Day-specific menus for multi-day events
  dayMenus?: Record<number, EventMenuCourse[]>;
};

type MenuStyle = "course_meal" | "buffet" | "street_food";

type Recipe = {
  id: string;
  name: string;
  cuisine?: string;
  category?: string;
  prepTime?: number;
  dietary?: string[];
  servings?: number;
  ingredients?: Array<{
    name: string;
    quantity: number | null;
    unit: string | null;
    preparation?: string;
  }>;
};

// Types for AI suggestions
type RecipeSuggestion = {
  name: string;
  course: CourseType;
  description: string;
  keyIngredients: string[];
  prepComplexity: "simple" | "moderate" | "complex";
  servingStyle: string;
};

type DrinkSuggestion = {
  name: string;
  type: string;
  isAlcoholic: boolean;
  description: string;
  pairsWith: string[];
  servingNotes?: string;
};

// ShoppingListItem imported from @/app/lib/core/shared/types

interface MenuDesignProps {
  menu: EventMenu;
  recipes: Recipe[];
  guestCount: number;
  menuStyle?: MenuStyle;
  multiDay?: boolean;
  numberOfDays?: number;
  onUpdate: (menu: EventMenu) => void;
  onCreateRecipe: () => void;
  onContinue?: () => void; // Navigate to next phase
  // Event context for AI suggestions
  eventLocation?: string;
  eventDate?: string;
  eventOccasion?: string;
  // Constraints from Event Brief
  eventConstraints?: string[];
  dietaryRequirements?: string[];
  // Shopping list (derived from menu, read-only preview)
  shoppingList?: ShoppingListItem[];
}

const COURSE_LABELS: Record<CourseType, string> = {
  starter: "Starters",
  main: "Mains",
  dessert: "Desserts",
  side: "Sides",
  beverage: "Beverages",
};

const COURSE_ORDER: CourseType[] = ["starter", "main", "dessert", "side", "beverage"];

// ────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ────────────────────────────────────────────────────────────────────────────

export function MenuDesign({
  menu,
  recipes,
  guestCount,
  menuStyle = "course_meal",
  multiDay = false,
  numberOfDays = 1,
  onUpdate,
  onCreateRecipe,
  onContinue,
  eventLocation,
  eventDate,
  eventOccasion,
  eventConstraints = [],
  dietaryRequirements = [],
  shoppingList = [],
}: MenuDesignProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [showAIAssist, setShowAIAssist] = useState(false);
  const [expandedRecipeIngredients, setExpandedRecipeIngredients] = useState<Set<string>>(new Set());
  const [shoppingListExpanded, setShoppingListExpanded] = useState(false);
  
  // Pairing assistant state
  const [pairingMessage, setPairingMessage] = useState<string | null>(null);
  const [currentPairingSuggestion, setCurrentPairingSuggestion] = useState<RecipeSuggestion | null>(null);
  const [pairingSuggestionIndex, setPairingSuggestionIndex] = useState(0);
  const [recipeSuggestions, setRecipeSuggestions] = useState<RecipeSuggestion[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  
  // Drink pairing state
  const [drinkSuggestions, setDrinkSuggestions] = useState<{ alcoholic: DrinkSuggestion[]; nonAlcoholic: DrinkSuggestion[] } | null>(null);
  const [loadingDrinks, setLoadingDrinks] = useState(false);
  const [showDrinkPanel, setShowDrinkPanel] = useState(false);
  const [lens, setLens] = useState<"start" | "cuisine" | "search" | "all">("start");
  const [visibleCount, setVisibleCount] = useState(12);
  const [selectedDay, setSelectedDay] = useState(1);
  const [activeCourse, setActiveCourse] = useState<CourseType>("main");

  // Get style-specific configuration
  const styleConfig = useMemo(() => {
    switch (menuStyle) {
      case "street_food":
        return {
          label: "Street Food Menu",
          description: "Select 1-3 signature dishes",
          maxDishes: 3,
          showCourses: false,
        };
      case "buffet":
        return {
          label: "Buffet Menu",
          description: "Build a generous spread",
          maxDishes: null,
          showCourses: true,
        };
      default:
        return {
          label: "Course Menu",
          description: "Design your multi-course experience",
          maxDishes: null,
          showCourses: true,
        };
    }
  }, [menuStyle]);

  // Keep discovery progressive: reset the amount shown when the user changes the lens or filters.
  useMemo(() => {
    setVisibleCount(12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lens, searchQuery, selectedCuisine]);

  // Get unique cuisines from recipes
  const cuisines = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach((r) => {
      if (r.cuisine) set.add(r.cuisine);
    });
    return Array.from(set).sort();
  }, [recipes]);

  // Filter recipes
  const filteredRecipes = useMemo(() => {
    return recipes.filter((r) => {
      const matchesSearch = !searchQuery || 
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.cuisine?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCuisine = !selectedCuisine || r.cuisine === selectedCuisine;
      return matchesSearch && matchesCuisine;
    });
  }, [recipes, searchQuery, selectedCuisine]);

  // Get recipes by ID
  const getRecipe = (id: string) => recipes.find((r) => r.id === id);

  // Get course by type, creating if needed
  const getCourse = (type: CourseType): EventMenuCourse => {
    const existing = menu.courses.find((c) => c.type === type);
    if (existing) return existing;
    return { id: crypto.randomUUID(), type, recipeIds: [] };
  };

  // Add recipe to course
  const addRecipeToCourse = (recipeId: string, courseType: CourseType) => {
    const updatedCourses = [...menu.courses];
    const courseIndex = updatedCourses.findIndex((c) => c.type === courseType);
    
    if (courseIndex >= 0) {
      if (!updatedCourses[courseIndex].recipeIds.includes(recipeId)) {
        updatedCourses[courseIndex] = {
          ...updatedCourses[courseIndex],
          recipeIds: [...updatedCourses[courseIndex].recipeIds, recipeId],
        };
      }
    } else {
      updatedCourses.push({
        id: crypto.randomUUID(),
        type: courseType,
        recipeIds: [recipeId],
      });
    }

    onUpdate({ ...menu, courses: updatedCourses });
  };

  // Remove recipe from course
  const removeRecipeFromCourse = (recipeId: string, courseType: CourseType) => {
    const updatedCourses = menu.courses.map((c) => {
      if (c.type === courseType) {
        const newPortions = { ...(c.portions || {}) };
        delete newPortions[recipeId];
        return { ...c, recipeIds: c.recipeIds.filter((id) => id !== recipeId), portions: newPortions };
      }
      return c;
    }).filter((c) => c.recipeIds.length > 0);

    onUpdate({ ...menu, courses: updatedCourses });
  };

  // Update portion count for a recipe
  const updateRecipePortions = (recipeId: string, courseType: CourseType, portions: number) => {
    const updatedCourses = menu.courses.map((c) => {
      if (c.type === courseType) {
        return { 
          ...c, 
          portions: { ...(c.portions || {}), [recipeId]: portions }
        };
      }
      return c;
    });
    onUpdate({ ...menu, courses: updatedCourses });
  };

  // Get portion count for a recipe
  const getRecipePortions = (recipeId: string, courseType: CourseType): number => {
    const course = menu.courses.find((c) => c.type === courseType);
    return course?.portions?.[recipeId] || guestCount || 1;
  };

  // Check if at street food limit
  const isAtStreetFoodLimit = menuStyle === "street_food" && totalRecipes >= (styleConfig.maxDishes || Infinity);

  // Calculate totals
  const totalRecipes = menu.courses.reduce((sum, c) => sum + c.recipeIds.length, 0);
  const totalPrepTime = menu.courses.reduce((sum, c) => {
    return sum + c.recipeIds.reduce((rSum, id) => {
      const recipe = getRecipe(id);
      return rSum + (recipe?.prepTime || 30);
    }, 0);
  }, 0);

  // Infer course type from recipe category
  const inferCourseType = (recipe: Recipe): CourseType => {
    const cat = recipe.category?.toLowerCase();
    if (cat === "starter" || cat === "appetizer") return "starter";
    if (cat === "main" || cat === "entree") return "main";
    if (cat === "dessert" || cat === "sweet") return "dessert";
    if (cat === "side" || cat === "accompaniment") return "side";
    if (cat === "beverage" || cat === "drink") return "beverage";
    return "main"; // default
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  // AI-POWERED DRINK PAIRING
  // ─────────────────────────────────────────────────────────────────────────

  const fetchDrinkPairings = async () => {
    const allDishes = menu.courses
      .filter((c) => c.type !== "beverage")
      .flatMap((c) => c.recipeIds.map((id) => getRecipe(id)?.name))
      .filter(Boolean) as string[];

    if (allDishes.length === 0) return;
    
    setLoadingDrinks(true);
    try {
      const res = await fetch("/api/arc/suggest-drink-pairings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dishes: allDishes,
          occasion: eventOccasion,
          guestCount,
          location: eventLocation,
        }),
      });
      const data = await res.json();
      setDrinkSuggestions({
        alcoholic: data.alcoholic || [],
        nonAlcoholic: data.nonAlcoholic || [],
      });
      setShowDrinkPanel(true);
    } catch (err) {
      console.error("Failed to fetch drink pairings:", err);
    } finally {
      setLoadingDrinks(false);
    }
  };

  return (
    <div className="h-full flex bg-[#FAF8F4]">
      {/* Left: Course builder */}
      <div className="w-[320px] border-r border-[#E0D4BF] bg-[#FBF4E8] p-4 overflow-auto">
        {/* Menu style header */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-[#4A331D]">
            {styleConfig.label}
          </h3>
          <p className="text-xs text-[#8B7E6A] mt-1">
            {styleConfig.description}
          </p>
        </div>

        {/* Dietary & Constraints reminder */}
        {(dietaryRequirements.length > 0 || eventConstraints.length > 0) && (
          <div className="mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-[10px] uppercase tracking-wider text-blue-600 font-semibold mb-1">
              Keep in mind
            </div>
            <div className="flex flex-wrap gap-1">
              {dietaryRequirements.map((req, i) => (
                <span key={`diet-${i}`} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full">
                  {req}
                </span>
              ))}
              {eventConstraints.map((constraint, i) => (
                <span key={`const-${i}`} className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded-full">
                  {constraint}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Multi-day tabs */}
        {multiDay && numberOfDays > 1 && (
          <div className="flex gap-1 mb-4 pb-3 border-b border-[#E0D4BF] overflow-x-auto">
            {Array.from({ length: numberOfDays }, (_, i) => i + 1).map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition ${
                  selectedDay === day
                    ? "bg-[#2F2A25] text-white"
                    : "bg-[#E8DFD0] text-[#4A331D] hover:bg-[#DED4C3]"
                }`}
              >
                Day {day}
              </button>
            ))}
          </div>
        )}

        {/* Street food limit warning */}
        {isAtStreetFoodLimit && (
          <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            Street food limit reached ({styleConfig.maxDishes} dishes). Remove a dish to add another.
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-[#8B7E6A] uppercase tracking-wider">
            {styleConfig.showCourses ? "Courses" : "Dishes"}
          </span>
          <button
            onClick={() => setShowAIAssist(!showAIAssist)}
            className={`px-3 py-1 text-xs rounded-lg transition ${
              showAIAssist
                ? "bg-[#2F2A25] text-white"
                : "bg-[#E8DFD0] text-[#4A331D] hover:bg-[#DED4C3]"
            }`}
          >
            Pairing Assistant
          </button>
        </div>

        {/* Pairing Assistant panel */}
        {showAIAssist && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="text-xs font-medium text-amber-800 mb-3">Pairing Assistant</div>
            
            {/* Pairing action buttons */}
            <div className="space-y-2 mb-3">
              <button
                onClick={() => {
                  setPairingMessage("Pairing suggestions coming next");
                  setActiveCourse("side");
                }}
                className="w-full px-3 py-2 text-xs text-left rounded-lg bg-white border border-amber-200 hover:bg-amber-100 transition"
              >
                Suggest a Side
              </button>
              <button
                onClick={() => {
                  setPairingMessage("Pairing suggestions coming next");
                  setActiveCourse("dessert");
                }}
                className="w-full px-3 py-2 text-xs text-left rounded-lg bg-white border border-amber-200 hover:bg-amber-100 transition"
              >
                Suggest a Dessert
              </button>
              <button
                onClick={() => {
                  setPairingMessage("Pairing suggestions coming next");
                }}
                className="w-full px-3 py-2 text-xs text-left rounded-lg bg-white border border-amber-200 hover:bg-amber-100 transition"
              >
                Try Another Pairing
              </button>
            </div>

            {/* Pairing message or suggestion */}
            {pairingMessage && !currentPairingSuggestion && (
              <div className="text-xs text-amber-700 italic">{pairingMessage}</div>
            )}

            {/* Single suggestion display (Task 5) */}
            {currentPairingSuggestion && (
              <div className="p-3 bg-white border border-amber-200 rounded-lg">
                <div className="font-medium text-[#2F2A25] text-sm">{currentPairingSuggestion.name}</div>
                <div className="text-xs text-[#8B7E6A] mt-1">{currentPairingSuggestion.description}</div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      alert(`Would add: ${currentPairingSuggestion.name}`);
                      setCurrentPairingSuggestion(null);
                    }}
                    className="px-3 py-1.5 text-xs bg-[#4A331D] text-white rounded-lg hover:bg-[#2F2A25]"
                  >
                    Use this
                  </button>
                  <button
                    onClick={() => {
                      const nextIdx = (pairingSuggestionIndex + 1) % recipeSuggestions.length;
                      setPairingSuggestionIndex(nextIdx);
                      setCurrentPairingSuggestion(recipeSuggestions[nextIdx] || null);
                    }}
                    className="px-3 py-1.5 text-xs border border-amber-200 rounded-lg hover:bg-amber-50"
                  >
                    Try another
                  </button>
                </div>
              </div>
            )}

            {/* Quick tips (only when no active suggestion) */}
            {!currentPairingSuggestion && totalRecipes === 0 && (
              <div className="text-xs text-amber-700 mt-2">
                Add a main course first to get pairing suggestions.
              </div>
            )}
          </div>
        )}

        {/* Course sections — CLICK TO SELECT */}
        <div className="space-y-3">
          {COURSE_ORDER.map((type) => {
            const course = getCourse(type);
            const courseRecipes = course.recipeIds
              .map((id) => getRecipe(id))
              .filter(Boolean) as Recipe[];
            const isActive = activeCourse === type;

            return (
              <div 
                key={type} 
                className={`rounded-xl transition-all cursor-pointer ${
                  isActive 
                    ? "bg-white border-2 border-[#4A331D] shadow-sm" 
                    : "bg-[#F5ECDD] border border-[#E0D4BF] hover:border-[#C5B8A5]"
                }`}
                onClick={() => setActiveCourse(type)}
              >
                {/* Course header */}
                <div className={`flex items-center justify-between px-4 py-3 ${isActive ? "border-b border-[#E0D4BF]" : ""}`}>
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-[#4A331D] animate-pulse" />
                    )}
                    <span className={`text-sm font-medium ${isActive ? "text-[#2F2A25]" : "text-[#4A331D]"}`}>
                      {COURSE_LABELS[type]}
                    </span>
                    {isActive && (
                      <span className="text-[10px] uppercase tracking-wider text-[#8B7E6A] bg-[#E8DFD0] px-2 py-0.5 rounded">
                        Adding
                      </span>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    courseRecipes.length > 0 
                      ? "bg-[#4A331D] text-white" 
                      : "text-[#8B7E6A]"
                  }`}>
                    {courseRecipes.length}
                  </span>
                </div>
                
                {/* Course recipes (only show when has recipes or is active) */}
                {(courseRecipes.length > 0 || isActive) && (
                  <div className="px-3 pb-3" onClick={(e) => e.stopPropagation()}>
                    {courseRecipes.length > 0 ? (
                      <div className="space-y-1 mt-2">
                        {courseRecipes.map((recipe) => {
                          const portions = getRecipePortions(recipe.id, type);
                          return (
                            <div
                              key={recipe.id}
                              className="px-3 py-2 bg-[#FBF4E8] border border-[#E0D4BF] rounded-lg text-sm"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[#2F2A25] truncate flex-1 font-medium">{recipe.name}</span>
                                <div className="flex items-center gap-2 ml-2">
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => updateRecipePortions(recipe.id, type, Math.max(1, portions - 1))}
                                      className="w-5 h-5 text-xs text-[#8B7E6A] hover:text-[#4A331D] border border-[#E0D4BF] rounded bg-white"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min="1"
                                      value={portions}
                                      onChange={(e) => updateRecipePortions(recipe.id, type, Math.max(1, parseInt(e.target.value) || 1))}
                                      className="w-12 text-center text-xs py-0.5 border border-[#E0D4BF] rounded focus:outline-none focus:border-[#C5B8A5] bg-white"
                                    />
                                    <button
                                      onClick={() => updateRecipePortions(recipe.id, type, portions + 1)}
                                      className="w-5 h-5 text-xs text-[#8B7E6A] hover:text-[#4A331D] border border-[#E0D4BF] rounded bg-white"
                                    >
                                      +
                                    </button>
                                  </div>
                                  <button
                                    onClick={() => removeRecipeFromCourse(recipe.id, type)}
                                    className="text-[#8B7E6A] hover:text-red-600 transition"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                              {/* Per-recipe ingredient summary with provenance */}
                              {recipe.ingredients && recipe.ingredients.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-[#E0D4BF]">
                                  {(() => {
                                    const isExpanded = expandedRecipeIngredients.has(recipe.id);
                                    const recipeServings = recipe.servings || 4;
                                    const servingsAssumed = !recipe.servings;
                                    const scaleFactor = guestCount / recipeServings;
                                    const visibleIngredients = isExpanded 
                                      ? recipe.ingredients 
                                      : recipe.ingredients.slice(0, 5);
                                    
                                    return (
                                      <>
                                        {/* Provenance label */}
                                        <div className="text-[10px] text-[#A89D8A] mb-1">
                                          Scaled for {guestCount} guests
                                          {servingsAssumed && " · Recipe servings assumed: 4"}
                                        </div>
                                        <div className="text-xs text-[#8B7E6A] space-y-0.5">
                                          {visibleIngredients.map((ing, idx) => {
                                            const originalQty = ing.quantity || 0;
                                            const scaledQty = originalQty 
                                              ? Math.round(originalQty * scaleFactor * 10) / 10 
                                              : null;
                                            return (
                                              <div key={idx} className="flex justify-between">
                                                <span>{ing.name}</span>
                                                {scaledQty !== null && (
                                                  <span className="text-[#6F6352]">
                                                    {scaledQty} {ing.unit || ""}
                                                    <span className="text-[#A89D8A] ml-1">
                                                      (from {originalQty}{ing.unit ? ` ${ing.unit}` : ""})
                                                    </span>
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                        {recipe.ingredients.length > 5 && (
                                          <button
                                            onClick={() => {
                                              const newSet = new Set(expandedRecipeIngredients);
                                              if (isExpanded) {
                                                newSet.delete(recipe.id);
                                              } else {
                                                newSet.add(recipe.id);
                                              }
                                              setExpandedRecipeIngredients(newSet);
                                            }}
                                            className="mt-1 text-[10px] text-[#4A331D] hover:underline"
                                          >
                                            {isExpanded 
                                              ? "Show less" 
                                              : `+${recipe.ingredients.length - 5} more`}
                                          </button>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : isActive ? (
                      <div className="mt-2 space-y-2">
                        <div className="px-3 py-3 text-xs text-[#8B7E6A] border border-dashed border-[#C5B8A5] rounded-lg text-center bg-[#FBF4E8]">
                          👆 Browse recipes on the right to add
                        </div>
                        {/* Special "Suggest Drinks" button for beverages */}
                        {type === "beverage" && totalRecipes > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              fetchDrinkPairings();
                            }}
                            disabled={loadingDrinks}
                            className="w-full px-3 py-2 bg-[#4A331D] text-white text-xs rounded-lg hover:bg-[#2F2A25] transition flex items-center justify-center gap-2"
                          >
                            {loadingDrinks ? (
                              <>
                                <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                                Pairing drinks...
                              </>
                            ) : (
                              <>🍷 Suggest Drink Pairings</>
                            )}
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Menu summary */}
        <div className="mt-6 pt-4 border-t border-[#E0D4BF]">
          <div className="text-sm font-medium text-[#4A331D] mb-2">Menu Summary</div>
          <div className="space-y-1 text-xs text-[#6F6352]">
            <div>{totalRecipes} recipe{totalRecipes !== 1 ? "s" : ""}</div>
            <div>{guestCount} guests</div>
            <div>Est. prep: {Math.round(totalPrepTime / 60)} hours</div>
          </div>
          
          {/* Continue button */}
          {onContinue && totalRecipes > 0 && (
            <button
              onClick={onContinue}
              className="mt-4 w-full px-4 py-3 bg-[#2F2A25] text-white text-sm rounded-lg hover:bg-[#1A1A1A] transition font-medium"
            >
              Continue to Execution Plan →
            </button>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            DRINK PAIRING SUGGESTIONS PANEL
        ═══════════════════════════════════════════════════════════════ */}
        {showDrinkPanel && drinkSuggestions && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-amber-800">
                🍷 Drink Pairings
              </div>
              <button
                onClick={() => setShowDrinkPanel(false)}
                className="text-amber-600 hover:text-amber-800 text-xs"
              >
                Close
              </button>
            </div>

            {/* Alcoholic options */}
            {drinkSuggestions.alcoholic.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-medium text-amber-700 uppercase tracking-wider mb-2">
                  With Alcohol
                </div>
                <div className="space-y-1">
                  {drinkSuggestions.alcoholic.map((drink, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs"
                    >
                      <div className="font-medium text-amber-900">{drink.name}</div>
                      <div className="text-amber-700 mt-0.5">{drink.description}</div>
                      <div className="text-amber-500 text-[10px] mt-1">
                        Pairs with: {drink.pairsWith.join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Non-alcoholic options */}
            {drinkSuggestions.nonAlcoholic.length > 0 && (
              <div>
                <div className="text-xs font-medium text-amber-700 uppercase tracking-wider mb-2">
                  Non-Alcoholic
                </div>
                <div className="space-y-1">
                  {drinkSuggestions.nonAlcoholic.map((drink, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs"
                    >
                      <div className="font-medium text-amber-900">{drink.name}</div>
                      <div className="text-amber-700 mt-0.5">{drink.description}</div>
                      <div className="text-amber-500 text-[10px] mt-1">
                        Pairs with: {drink.pairsWith.join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Recipe library */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-[#4A331D] uppercase tracking-wider mb-3">
            Recipe options
          </h3>

          {/* Lens chooser (progressive discovery) */}
          {lens === "start" ? (
            <div className="bg-white border border-[#E0D4BF] rounded-xl p-5">
              <div className="text-sm font-medium text-[#2F2A25] mb-2">
                Start with a focus
              </div>
              <div className="text-sm text-[#8B7E6A] mb-4">
                Choose how to discover recipes for your menu.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => setLens("cuisine")}
                  className="px-4 py-3 rounded-lg bg-[#E8DFD0] hover:bg-[#DED4C3] text-[#4A331D] text-sm transition text-left"
                >
                  Cuisine
                  <div className="text-xs text-[#8B7E6A] mt-1">Filter by cuisine style</div>
                </button>
                <button
                  onClick={() => setLens("search")}
                  className="px-4 py-3 rounded-lg bg-[#E8DFD0] hover:bg-[#DED4C3] text-[#4A331D] text-sm transition text-left"
                >
                  Search
                  <div className="text-xs text-[#8B7E6A] mt-1">Find a known recipe</div>
                </button>
                <button
                  onClick={() => setLens("all")}
                  className="px-4 py-3 rounded-lg bg-[#E8DFD0] hover:bg-[#DED4C3] text-[#4A331D] text-sm transition text-left"
                >
                  Browse all
                  <div className="text-xs text-[#8B7E6A] mt-1">See entire library</div>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setLens("start");
                    setRecipeSuggestions([]);
                  }}
                  className="px-3 py-2 text-xs rounded-lg bg-[#FBF4E8] border border-[#E0D4BF] text-[#4A331D] hover:bg-[#F5ECDD] transition"
                >
                  ← Change focus
                </button>
                <div className="text-xs text-[#8B7E6A]">
                  {lens === "cuisine" ? "Cuisine-led" : lens === "search" ? "Search-led" : "Browse"}
                </div>
              </div>

              {/* Search (only when requested) */}
              {(lens === "search" || lens === "all") && (
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search recipes..."
                    className="w-full px-4 py-2 pl-9 bg-white border border-[#E0D4BF] rounded-lg text-sm text-[#2F2A25] focus:outline-none focus:border-[#C5B8A5]"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B7E6A]">
                    🔍
                  </span>
                </div>
              )}

              {/* Cuisine filter (only when requested) */}
              {(lens === "cuisine" || lens === "all") && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCuisine(null)}
                    className={`px-3 py-1 text-xs rounded-lg transition ${
                      !selectedCuisine
                        ? "bg-[#2F2A25] text-white"
                        : "bg-[#E8DFD0] text-[#4A331D] hover:bg-[#DED4C3]"
                    }`}
                  >
                    All
                  </button>
                  {cuisines.map((cuisine) => (
                    <button
                      key={cuisine}
                      onClick={() => setSelectedCuisine(cuisine === selectedCuisine ? null : cuisine)}
                      className={`px-3 py-1 text-xs rounded-lg transition ${
                        selectedCuisine === cuisine
                          ? "bg-[#2F2A25] text-white"
                          : "bg-[#E8DFD0] text-[#4A331D] hover:bg-[#DED4C3]"
                      }`}
                    >
                      {cuisine}
                    </button>
                  ))}
                </div>
              )}

            </div>
          )}
        </div>

        {/* Active course indicator */}
        <div className="mb-4 flex items-center gap-2 px-4 py-2 bg-[#E8DFD0] rounded-lg border border-[#C5B8A5]">
          <span className="w-2 h-2 rounded-full bg-[#4A331D] animate-pulse" />
          <span className="text-sm text-[#4A331D]">
            Adding to: <strong>{COURSE_LABELS[activeCourse]}</strong>
          </span>
          <span className="text-xs text-[#8B7E6A] ml-auto">
            Click a course on the left to change
          </span>
        </div>

        {/* Recipe grid */}
        {lens !== "start" &&
        (lens === "all" ||
          (lens === "cuisine" && !!selectedCuisine) ||
          (lens === "search" && searchQuery.trim().length > 0)) ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredRecipes.slice(0, visibleCount).map((recipe) => {
                // Check if recipe is added to ANY course
                const addedToCourse = menu.courses.find((c) => c.recipeIds.includes(recipe.id));
                const isAddedToActive = addedToCourse?.type === activeCourse;
                const isAddedElsewhere = addedToCourse && addedToCourse.type !== activeCourse;

                return (
                  <div
                    key={recipe.id}
                    className={`p-4 border rounded-lg transition ${
                      isAddedToActive
                        ? "bg-[#4A331D] border-[#2F2A25]"
                        : isAddedElsewhere
                        ? "bg-[#E8DFD0] border-[#C5B8A5]"
                        : "bg-white border-[#E0D4BF] hover:border-[#C5B8A5]"
                    }`}
                  >
                    <div className={`text-sm font-medium mb-1 truncate ${isAddedToActive ? "text-white" : "text-[#2F2A25]"}`}>
                      {recipe.name}
                    </div>
                    <div className={`text-xs mb-2 ${isAddedToActive ? "text-white/70" : "text-[#8B7E6A]"}`}>
                      {recipe.cuisine || "—"} · {recipe.category || "—"}
                    </div>
                    {recipe.dietary && recipe.dietary.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {recipe.dietary.map((d) => (
                          <span
                            key={d}
                            className={`px-1.5 py-0.5 text-[10px] rounded ${
                              isAddedToActive 
                                ? "bg-white/20 text-white" 
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {/* Show where it's added if in another course */}
                    {isAddedElsewhere && (
                      <div className="text-[10px] text-[#6F6352] mb-2 flex items-center gap-1">
                        <span>In {COURSE_LABELS[addedToCourse.type]}</span>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        if (isAddedToActive) {
                          // Remove from active course
                          removeRecipeFromCourse(recipe.id, activeCourse);
                        } else if (isAddedElsewhere) {
                          // Move to active course (remove from old, add to new)
                          removeRecipeFromCourse(recipe.id, addedToCourse.type);
                          addRecipeToCourse(recipe.id, activeCourse);
                        } else {
                          // Add to active course
                          addRecipeToCourse(recipe.id, activeCourse);
                        }
                      }}
                      disabled={isAtStreetFoodLimit && !isAddedToActive && !isAddedElsewhere}
                      className={`w-full px-3 py-1.5 text-xs rounded-lg transition ${
                        isAddedToActive
                          ? "bg-white text-[#4A331D] hover:bg-gray-100"
                          : isAddedElsewhere
                          ? "bg-[#4A331D] text-white hover:bg-[#2F2A25]"
                          : isAtStreetFoodLimit
                          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                          : "bg-[#E8DFD0] text-[#4A331D] hover:bg-[#DED4C3]"
                      }`}
                    >
                      {isAddedToActive 
                        ? "✓ Added — Remove" 
                        : isAddedElsewhere 
                        ? `Move to ${COURSE_LABELS[activeCourse]}`
                        : `+ Add to ${COURSE_LABELS[activeCourse]}`}
                    </button>
                  </div>
                );
              })}
            </div>

            {filteredRecipes.length > visibleCount && (
              <button
                onClick={() => setVisibleCount((v) => v + 12)}
                className="mt-4 w-full py-3 bg-[#FBF4E8] border border-[#E0D4BF] rounded-lg text-sm text-[#4A331D] hover:bg-[#F5ECDD] transition"
              >
                Show more recipes
              </button>
            )}
          </>
        ) : (
          lens !== "start" && (
            <div className="bg-[#FBF4E8] border border-[#E0D4BF] rounded-xl p-5 text-sm text-[#8B7E6A]">
              {lens === "cuisine" && !selectedCuisine
                ? "Pick a cuisine to see suggestions."
                : lens === "search" && searchQuery.trim().length === 0
                ? "Type a recipe name to start searching."
                : "Choose a focus to see recipes."}
            </div>
          )
        )}

        {/* Create new recipe */}
        <button
          onClick={onCreateRecipe}
          className="mt-4 w-full py-3 border-2 border-dashed border-[#E0D4BF] rounded-lg text-sm text-[#8B7E6A] hover:border-[#C5B8A5] hover:text-[#4A331D] transition"
        >
          + Create new recipe
        </button>

        {/* ════════════════════════════════════════════════════════════════════
            SHOPPING LIST PREVIEW — Collapsible, text-forward
        ════════════════════════════════════════════════════════════════════ */}
        {shoppingList.length > 0 && (
          <div className="mt-8 pt-6 border-t border-[#E0D4BF]">
            <button
              onClick={() => setShoppingListExpanded(!shoppingListExpanded)}
              className="flex items-center justify-between w-full text-left"
            >
              <h3 className="text-sm font-medium text-[#2F2A25]">
                Procurement Preview · {shoppingList.length} item{shoppingList.length !== 1 ? "s" : ""}
              </h3>
              <span className="text-xs text-[#8B7E6A]">
                {shoppingListExpanded ? "Hide" : "Show"}
              </span>
            </button>
            
            {shoppingListExpanded && (
              <div className="mt-3 space-y-1">
                <p className="text-xs text-[#A89D8A] pb-2">
                  Required amounts scaled from recipes × {guestCount} guests
                </p>
                {shoppingList.map((item, idx) => (
                  <div key={idx} className="flex items-center py-1 text-sm">
                    <span className="flex-1 text-[#2F2A25]">
                      {item.ingredientName}
                    </span>
                    <span className="text-[#8B7E6A] text-right">
                      {item.quantity} {item.unit}
                    </span>
                  </div>
                ))}
                <p className="text-xs text-[#A89D8A] pt-2 border-t border-[#E0D4BF] mt-2">
                  Prices from uploaded invoices in Procurement List
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export type { EventMenu, EventMenuCourse, CourseType, Recipe };

