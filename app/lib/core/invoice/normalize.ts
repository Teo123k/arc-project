/**
 * Ingredient Name Normalization
 * 
 * Produces stable comparison keys for ingredient matching.
 * NO AI inference, deterministic only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// NON-SEMANTIC WORDS TO REMOVE
// ─────────────────────────────────────────────────────────────────────────────

const NON_SEMANTIC_WORDS = new Set([
  // Freshness/quality descriptors
  "fresh",
  "frozen",
  "dried",
  "canned",
  "tinned",
  "bottled",
  "packed",
  "vacuum",
  "sealed",
  
  // Organic/source descriptors
  "organic",
  "bio",
  "natural",
  "local",
  "imported",
  "domestic",
  "farm",
  "homemade",
  "handmade",
  "artisan",
  "artisanal",
  "premium",
  "select",
  "choice",
  "grade",
  "quality",
  
  // Size descriptors
  "small",
  "medium",
  "large",
  "extra",
  "jumbo",
  "mini",
  "baby",
  "giant",
  
  // Preparation states
  "whole",
  "sliced",
  "diced",
  "chopped",
  "minced",
  "ground",
  "crushed",
  "grated",
  "shredded",
  "peeled",
  "unpeeled",
  "boneless",
  "skinless",
  "filleted",
  "deveined",
  "cleaned",
  "washed",
  "trimmed",
  "cut",
  "cubed",
  
  // Color modifiers (for non-essential cases)
  "white",
  "brown",
  "black",
  "green",
  "red",
  "yellow",
  "golden",
  
  // Generic qualifiers
  "fine",
  "coarse",
  "thick",
  "thin",
  "raw",
  "cooked",
  "roasted",
  "toasted",
  "smoked",
  "cured",
  "salted",
  "unsalted",
  "sweetened",
  "unsweetened",
]);

// ─────────────────────────────────────────────────────────────────────────────
// SIMPLE PLURAL RULES (no external libs)
// ─────────────────────────────────────────────────────────────────────────────

const IRREGULAR_PLURALS: Record<string, string> = {
  "tomatoes": "tomato",
  "potatoes": "potato",
  "mangoes": "mango",
  "heroes": "hero",
  "leaves": "leaf",
  "knives": "knife",
  "halves": "half",
  "loaves": "loaf",
  "shelves": "shelf",
  "wolves": "wolf",
  "wives": "wife",
  "lives": "life",
  "calves": "calf",
  "elves": "elf",
  "selves": "self",
  "thieves": "thief",
  "feet": "foot",
  "geese": "goose",
  "teeth": "tooth",
  "mice": "mouse",
  "men": "man",
  "women": "woman",
  "children": "child",
  "oxen": "ox",
  "fish": "fish",
  "sheep": "sheep",
  "deer": "deer",
  "species": "species",
  "series": "series",
};

function singularize(word: string): string {
  // Check irregular plurals first
  if (IRREGULAR_PLURALS[word]) {
    return IRREGULAR_PLURALS[word];
  }
  
  // Common plural endings
  if (word.endsWith("ies") && word.length > 4) {
    return word.slice(0, -3) + "y"; // berries → berry
  }
  if (word.endsWith("ves")) {
    return word.slice(0, -3) + "f"; // loaves → loaf (fallback)
  }
  if (word.endsWith("oes")) {
    return word.slice(0, -2); // tomatoes → tomato (fallback)
  }
  if (word.endsWith("ses") || word.endsWith("xes") || word.endsWith("zes") || 
      word.endsWith("ches") || word.endsWith("shes")) {
    return word.slice(0, -2); // boxes → box, dishes → dish
  }
  if (word.endsWith("s") && word.length > 2 && !word.endsWith("ss")) {
    return word.slice(0, -1); // apples → apple
  }
  
  return word;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

export type NormalizedIngredient = {
  key: string;           // Stable comparison key
  original: string;      // Original input
  words: string[];       // Semantic words retained
};

/**
 * Normalize an ingredient name to a stable comparison key.
 */
export function normalizeIngredientName(name: string): NormalizedIngredient {
  const original = name;
  
  // Step 1: Lowercase
  let normalized = name.toLowerCase();
  
  // Step 2: Remove punctuation (keep spaces and alphanumeric)
  normalized = normalized.replace(/[^\w\s]/g, " ");
  
  // Step 3: Split into words
  const words = normalized.split(/\s+/).filter(Boolean);
  
  // Step 4: Remove non-semantic words
  const semanticWords = words.filter(word => !NON_SEMANTIC_WORDS.has(word));
  
  // Step 5: Singularize each word
  const singularWords = semanticWords.map(singularize);
  
  // Step 6: Sort alphabetically for order-independent matching
  const sortedWords = [...singularWords].sort();
  
  // Step 7: Create stable key
  const key = sortedWords.join("_");
  
  return {
    key,
    original,
    words: singularWords,
  };
}

/**
 * Compare two ingredient names for similarity.
 * Returns a score from 0 (no match) to 1 (exact match).
 */
export function compareIngredientNames(nameA: string, nameB: string): number {
  const a = normalizeIngredientName(nameA);
  const b = normalizeIngredientName(nameB);
  
  // Exact key match
  if (a.key === b.key) {
    return 1.0;
  }
  
  // Word overlap scoring
  const aWords = new Set(a.words);
  const bWords = new Set(b.words);
  
  let matches = 0;
  for (const word of aWords) {
    if (bWords.has(word)) {
      matches++;
    }
  }
  
  const totalWords = Math.max(aWords.size, bWords.size);
  if (totalWords === 0) {
    return 0;
  }
  
  return matches / totalWords;
}

/**
 * Check if a name contains another (substring match on normalized key).
 */
export function ingredientContains(haystack: string, needle: string): boolean {
  const h = normalizeIngredientName(haystack);
  const n = normalizeIngredientName(needle);
  
  // All needle words must be in haystack
  const haystackWords = new Set(h.words);
  return n.words.every(word => haystackWords.has(word));
}

