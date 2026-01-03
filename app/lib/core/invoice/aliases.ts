/**
 * Ingredient Alias Dictionary
 * 
 * Manual, controlled alias mappings for ingredient matching.
 * Used only when exact/normalized match fails.
 * 
 * NO auto-learning at this stage — manual additions only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// ALIAS GROUPS
// Each array contains synonymous ingredient names.
// ─────────────────────────────────────────────────────────────────────────────

const ALIAS_GROUPS: string[][] = [
  // Vegetables - naming variations
  ["zucchini", "courgette"],
  ["eggplant", "aubergine", "brinjal"],
  ["bell pepper", "capsicum", "sweet pepper"],
  ["cilantro", "coriander", "dhania"],
  ["scallion", "spring onion", "green onion"],
  ["arugula", "rocket", "roquette"],
  ["snow pea", "mange tout"],
  ["chickpea", "garbanzo", "chana"],
  ["fava bean", "broad bean"],
  ["butternut squash", "butternut pumpkin"],
  
  // Herbs
  ["basil", "thai basil", "sweet basil"],
  ["parsley", "flat leaf parsley", "italian parsley"],
  ["chinese parsley", "coriander leaves", "cilantro leaves"],
  
  // Proteins
  ["shrimp", "prawn"],
  ["ground beef", "beef mince", "minced beef"],
  ["ground pork", "pork mince", "minced pork"],
  ["ground chicken", "chicken mince", "minced chicken"],
  ["ground lamb", "lamb mince", "minced lamb"],
  ["chicken thigh", "thigh fillet", "boneless thigh"],
  ["chicken breast", "breast fillet", "boneless breast"],
  
  // Seafood
  ["squid", "calamari"],
  ["octopus", "tako"],
  ["tuna", "ahi", "maguro"],
  ["salmon", "sake"],
  ["crab", "crab meat"],
  ["lobster", "lobster meat"],
  
  // Dairy
  ["heavy cream", "double cream", "thickened cream", "whipping cream"],
  ["light cream", "single cream", "pouring cream"],
  ["sour cream", "creme fraiche"],
  ["cream cheese", "philadelphia"],
  ["mozzarella", "mozzarella cheese"],
  ["parmesan", "parmigiano", "parmigiano reggiano", "grana padano"],
  ["cheddar", "cheddar cheese"],
  ["feta", "feta cheese"],
  
  // Starches
  ["all purpose flour", "plain flour", "ap flour"],
  ["self raising flour", "self rising flour"],
  ["cornstarch", "corn starch", "corn flour", "maizena"],
  ["potato starch", "potato flour"],
  
  // Oils & Fats
  ["vegetable oil", "cooking oil", "neutral oil", "canola oil"],
  ["olive oil", "evoo", "extra virgin olive oil"],
  ["sesame oil", "gingelly oil"],
  ["butter", "unsalted butter", "salted butter"],
  
  // Sugars & Sweeteners
  ["sugar", "white sugar", "granulated sugar", "caster sugar"],
  ["brown sugar", "light brown sugar", "dark brown sugar"],
  ["powdered sugar", "icing sugar", "confectioners sugar"],
  ["honey", "raw honey", "pure honey"],
  ["maple syrup", "pure maple syrup"],
  
  // Condiments
  ["soy sauce", "shoyu", "soya sauce"],
  ["fish sauce", "nam pla", "nuoc mam"],
  ["oyster sauce", "oyster flavored sauce"],
  ["worcestershire", "worcestershire sauce", "lea perrins"],
  ["ketchup", "catsup", "tomato ketchup", "tomato sauce"],
  ["mayonnaise", "mayo"],
  ["mustard", "prepared mustard", "yellow mustard", "dijon mustard"],
  
  // Vinegars
  ["white vinegar", "distilled vinegar"],
  ["rice vinegar", "rice wine vinegar"],
  ["balsamic vinegar", "balsamic"],
  ["apple cider vinegar", "cider vinegar", "acv"],
  
  // Spices
  ["chili powder", "chilli powder", "chile powder"],
  ["chili flakes", "chilli flakes", "red pepper flakes", "crushed red pepper"],
  ["cayenne", "cayenne pepper"],
  ["paprika", "sweet paprika", "hungarian paprika"],
  ["cumin", "cumin powder", "ground cumin", "jeera"],
  ["coriander seed", "coriander powder", "ground coriander", "dhania powder"],
  ["turmeric", "turmeric powder", "ground turmeric", "haldi"],
  ["garam masala", "garam massala"],
  ["curry powder", "curry spice"],
  ["cinnamon", "ground cinnamon", "cinnamon powder"],
  ["nutmeg", "ground nutmeg"],
  ["clove", "ground clove", "cloves"],
  ["cardamom", "cardamom pods", "green cardamom"],
  ["black pepper", "pepper", "ground pepper", "peppercorn"],
  ["white pepper", "ground white pepper"],
  
  // Miscellaneous
  ["baking soda", "bicarbonate of soda", "bicarb"],
  ["baking powder", "baking pwdr"],
  ["vanilla extract", "vanilla essence", "vanilla"],
  ["cocoa powder", "cocoa", "unsweetened cocoa"],
  ["coconut milk", "coconut cream"],
  ["stock", "broth"],
  ["chicken stock", "chicken broth"],
  ["beef stock", "beef broth"],
  ["vegetable stock", "vegetable broth", "veggie broth"],
];

// ─────────────────────────────────────────────────────────────────────────────
// BUILD LOOKUP MAP
// ─────────────────────────────────────────────────────────────────────────────

// Map each alias to its canonical form (first item in group)
const aliasToCanonical = new Map<string, string>();
// Map canonical to all aliases
const canonicalToAliases = new Map<string, Set<string>>();

for (const group of ALIAS_GROUPS) {
  if (group.length < 2) continue;
  
  const canonical = group[0].toLowerCase();
  const aliasSet = new Set(group.map(a => a.toLowerCase()));
  
  canonicalToAliases.set(canonical, aliasSet);
  
  for (const alias of group) {
    aliasToCanonical.set(alias.toLowerCase(), canonical);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the canonical name for an ingredient (or the input if no alias exists).
 */
export function getCanonicalName(ingredient: string): string {
  const lower = ingredient.toLowerCase().trim();
  return aliasToCanonical.get(lower) || lower;
}

/**
 * Get all known aliases for an ingredient (including itself).
 */
export function getAliases(ingredient: string): string[] {
  const canonical = getCanonicalName(ingredient);
  const aliases = canonicalToAliases.get(canonical);
  
  if (aliases) {
    return Array.from(aliases);
  }
  
  return [ingredient.toLowerCase()];
}

/**
 * Check if two ingredient names are aliases of each other.
 */
export function areAliases(ingredientA: string, ingredientB: string): boolean {
  const canonicalA = getCanonicalName(ingredientA);
  const canonicalB = getCanonicalName(ingredientB);
  
  return canonicalA === canonicalB;
}

/**
 * Find if a name matches any alias in the dictionary.
 * Returns the canonical name if found, null otherwise.
 */
export function findAliasMatch(name: string): string | null {
  const lower = name.toLowerCase().trim();
  
  if (aliasToCanonical.has(lower)) {
    return aliasToCanonical.get(lower) || null;
  }
  
  // Try substring matching for compound names
  for (const [alias, canonical] of aliasToCanonical) {
    if (lower.includes(alias) || alias.includes(lower)) {
      return canonical;
    }
  }
  
  return null;
}

