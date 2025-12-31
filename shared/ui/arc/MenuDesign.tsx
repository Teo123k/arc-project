"use client";

import { useState, useMemo } from "react";

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
};

interface MenuDesignProps {
  menu: EventMenu;
  recipes: Recipe[];
  guestCount: number;
  menuStyle?: MenuStyle;
  multiDay?: boolean;
  numberOfDays?: number;
  onUpdate: (menu: EventMenu) => void;
  onCreateRecipe: () => void;
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
}: MenuDesignProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [showAIAssist, setShowAIAssist] = useState(false);
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
            AI Assist
          </button>
        </div>

        {/* AI Assist panel */}
        {showAIAssist && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="text-xs font-medium text-amber-800 mb-2">AI Suggestions</div>
            <ul className="text-xs text-amber-700 space-y-1">
              {totalRecipes === 0 && (
                <li>• Start by adding a main course</li>
              )}
              {menu.courses.find((c) => c.type === "main")?.recipeIds.length && 
               !menu.courses.find((c) => c.type === "starter") && (
                <li>• Consider adding a starter</li>
              )}
              {menu.courses.find((c) => c.type === "main")?.recipeIds.length && 
               !menu.courses.find((c) => c.type === "dessert") && (
                <li>• A dessert would complete the menu</li>
              )}
              {totalPrepTime > 360 && (
                <li>• Prep time is high ({Math.round(totalPrepTime / 60)}h). Consider simpler dishes.</li>
              )}
              {totalRecipes >= 3 && (
                <li>• Menu looks balanced!</li>
              )}
            </ul>
          </div>
        )}

        {/* Course sections */}
        <div className="space-y-4">
          {COURSE_ORDER.map((type) => {
            const course = getCourse(type);
            const courseRecipes = course.recipeIds
              .map((id) => getRecipe(id))
              .filter(Boolean) as Recipe[];

            return (
              <div key={type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#4A331D]">
                    {COURSE_LABELS[type]}
                  </span>
                  <span className="text-xs text-[#8B7E6A]">
                    {courseRecipes.length}
                  </span>
                </div>
                
                {courseRecipes.length > 0 ? (
                  <div className="space-y-1">
                    {courseRecipes.map((recipe) => {
                      const portions = getRecipePortions(recipe.id, type);
                      return (
                        <div
                          key={recipe.id}
                          className="flex items-center justify-between px-3 py-2 bg-white border border-[#E0D4BF] rounded-lg text-sm"
                        >
                          <span className="text-[#2F2A25] truncate flex-1">{recipe.name}</span>
                          <div className="flex items-center gap-2 ml-2">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => updateRecipePortions(recipe.id, type, Math.max(1, portions - 1))}
                                className="w-5 h-5 text-xs text-[#8B7E6A] hover:text-[#4A331D] border border-[#E0D4BF] rounded"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={portions}
                                onChange={(e) => updateRecipePortions(recipe.id, type, Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-12 text-center text-xs py-0.5 border border-[#E0D4BF] rounded focus:outline-none focus:border-[#C5B8A5]"
                              />
                              <button
                                onClick={() => updateRecipePortions(recipe.id, type, portions + 1)}
                                className="w-5 h-5 text-xs text-[#8B7E6A] hover:text-[#4A331D] border border-[#E0D4BF] rounded"
                              >
                                +
                              </button>
                            </div>
                            <button
                              onClick={() => removeRecipeFromCourse(recipe.id, type)}
                              className="text-[#8B7E6A] hover:text-[#4A331D]"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-3 py-2 text-xs text-[#8B7E6A] border border-dashed border-[#E0D4BF] rounded-lg">
                    No {COURSE_LABELS[type].toLowerCase()} added
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
        </div>
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
                Choose a cuisine, search by name, or browse the library.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => setLens("cuisine")}
                  className="px-4 py-3 rounded-lg bg-[#E8DFD0] hover:bg-[#DED4C3] text-[#4A331D] text-sm transition text-left"
                >
                  Cuisine
                  <div className="text-xs text-[#8B7E6A] mt-1">Start narrow</div>
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
                  <div className="text-xs text-[#8B7E6A] mt-1">Manual browsing</div>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLens("start")}
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

        {/* Recipe grid */}
        {lens !== "start" &&
        (lens === "all" ||
          (lens === "cuisine" && !!selectedCuisine) ||
          (lens === "search" && searchQuery.trim().length > 0)) ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredRecipes.slice(0, visibleCount).map((recipe) => {
            const courseType = inferCourseType(recipe);
            const isAdded = menu.courses.some((c) => c.recipeIds.includes(recipe.id));

            return (
              <div
                key={recipe.id}
                className={`p-4 border rounded-lg transition ${
                  isAdded
                    ? "bg-[#E8DFD0] border-[#C5B8A5]"
                    : "bg-white border-[#E0D4BF] hover:border-[#C5B8A5]"
                }`}
              >
                <div className="text-sm font-medium text-[#2F2A25] mb-1 truncate">
                  {recipe.name}
                </div>
                <div className="text-xs text-[#8B7E6A] mb-2">
                  {recipe.cuisine || "—"} · {recipe.category || "—"}
                </div>
                {recipe.dietary && recipe.dietary.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {recipe.dietary.map((d) => (
                      <span
                        key={d}
                        className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => {
                    if (isAdded) {
                      removeRecipeFromCourse(recipe.id, courseType);
                    } else {
                      addRecipeToCourse(recipe.id, courseType);
                    }
                  }}
                  className={`w-full px-3 py-1.5 text-xs rounded-lg transition ${
                    isAdded
                      ? "bg-[#4A331D] text-white hover:bg-[#2F2A25]"
                      : "bg-[#E8DFD0] text-[#4A331D] hover:bg-[#DED4C3]"
                  }`}
                >
                  {isAdded ? "Remove" : "+ Add"}
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
      </div>
    </div>
  );
}

export type { EventMenu, EventMenuCourse, CourseType, Recipe };

