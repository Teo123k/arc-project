import type { CanonicalRecipe } from "@/app/lib/arc/recipe/resolveCanonicalRecipe";

export type ARCState = {
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

export type RecipeIntelligence = {
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

  // UI / lifecycle helpers (used throughout the dashboard ingestion flow)
  needsReview?: boolean;
  confidence?: "low" | "medium" | "high";
  source?: "ocr" | "ai" | "user";
};

export type InvoiceItem = {
  name: string;           // Standardized ingredient name (lowercase, singular)
  originalName?: string;  // Original name from invoice
  quantity?: string;      // Numeric quantity
  unit?: string;          // Unit (kg, g, L, ml, pieces, etc.)
  unitPrice?: string;     // Price per unit
  lineTotal?: string;     // Total for this line
  price?: string;         // Legacy fallback
};

export type InvoiceIntelligence = {
  vendor?: string;
  country?: string;
  city?: string;
  currency?: string;
  date?: string;
  total?: string;
  items?: InvoiceItem[];
  confidence?: "low" | "medium" | "high";
  source?: "ocr" | "ai" | "user";
};

export type UploadedFile = {
  id: string;
  role: 'recipe' | 'invoice' | 'event' | 'note';
  name: string;
  type: string;
  size: number;
  lastModified?: number;
  extractedText?: string | null;
  extractionMethod?: "text" | "ocr" | "csv" | "unsupported";
  extractionError?: string | null;
  file?: File;
  canonicalRecipe?: CanonicalRecipe;
  recipeFolderId?: string | null;
  invoiceFolderId?: string | null;

  // Step C — AI-enriched recipe data
  recipeIntelligence?: RecipeIntelligence;
  // Invoice-specific parsed data
  invoiceIntelligence?: InvoiceIntelligence;
};

// ────────────────────────────────────────────────────────────────────────────
// EVENT PROJECT TYPES (Chef-Logic Flow: Idea → Verdict)
// ────────────────────────────────────────────────────────────────────────────

export type EventProjectPhase = 
  | "idea"
  | "clarify"
  | "menu"
  | "cost"
  | "risk"
  | "verdict"
  | "report";

export type EventPricingModel = "per_head" | "event_total";

export type EventKitchenSituation = {
  onSitePrep: boolean;
  externalKitchen: boolean;
  transportRequired: boolean;
};

export type EventMenuStyle = "course_meal" | "buffet" | "street_food";

export type EventDetails = {
  occasion?: string;
  guests?: number;
  location?: string;
  pricingModel?: EventPricingModel;
  priceAmount?: number;
  currency?: string;
  kitchen?: EventKitchenSituation;
  date?: string;
  serviceStart?: string;
  serviceEnd?: string;
  // Multi-day event support
  multiDay?: boolean;
  numberOfDays?: number;
  // Menu/service style
  menuStyle?: EventMenuStyle;
  // Dietary requirements extracted from brief
  dietaryRequirements?: string[];
};

export type EventMenuCourse = {
  id: string;
  type: "starter" | "main" | "dessert" | "side" | "beverage";
  recipeIds: string[];
};

export type EventMenu = {
  courses: EventMenuCourse[];
  guestCount: number;
  prepTimeEstimate?: number; // hours
};

export type EventCostItem = {
  ingredientName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  source: "invoice" | "market_avg" | "manual";
  total: number;
  verified: boolean;
};

export type EventCostBreakdown = {
  ingredients: EventCostItem[];
  subtotal: number;
  markupPercent?: number;
  markup?: number;
  staffCost?: number;
  transportCost?: number;
  otherCosts?: number;
  total: number;
};

export type EventOperationsTimeline = {
  entries: Array<{
    day: string; // "D-2", "D-1", "D-0"
    time?: string;
    task: string;
  }>;
};

export type EventRisk = {
  id: string;
  severity: "high" | "medium" | "low" | "ok";
  category: "staffing" | "equipment" | "timing" | "ingredients" | "weather" | "budget";
  description: string;
  mitigation?: string;
};

export type EventVerdict = "proceed" | "adjust" | "decline" | null;

export type EventProject = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  phase: EventProjectPhase;
  
  // Phase 1: Idea
  freeformNotes: string;
  uploadedFileIds: string[];
  
  // Phase 2: Clarify
  details: EventDetails;
  unknowns: string[];
  constraints: string[];
  
  // Phase 3: Menu
  menu: EventMenu;
  
  // Phase 4: Cost & Operations
  costBreakdown: EventCostBreakdown | null;
  operations: EventOperationsTimeline | null;
  
  // Phase 5: Risk
  risks: EventRisk[];
  
  // Phase 6: Verdict
  verdict: EventVerdict;
  verdictNotes?: string;
  verdictDate?: number;
  
  // Folder organization
  folderId?: string | null;
};

export type EventFolder = {
  id: string;
  name: string;
  createdAt: number;
  isHeader?: boolean;
  parentId?: string | null;
};


