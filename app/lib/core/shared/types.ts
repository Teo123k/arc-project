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
  // Seating & staffing
  seatingStyle?: string;
  staffCount?: number;
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

// Shopping List (derived from Menu, consumed by Cost)
export type ShoppingListItem = {
  ingredientName: string;
  quantity: number;
  unit: string;
  sources: string[];  // Recipe names this ingredient came from
  category?: "fresh" | "dry" | "other";
};

export type MatchConfidence = "exact" | "unit-converted" | "alias" | "none";

export type CostItemAudit = {
  source: "invoice" | "historical-invoice" | "manual" | "unknown";
  confidence: MatchConfidence;
  invoiceId?: string;
  invoiceVendor?: string;
  timestamp?: string;
  unitConverted?: boolean;
  aliasUsed?: boolean;
};

export type EventCostItem = {
  ingredientName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  source: "invoice" | "historical-invoice" | "manual" | "unknown";
  total: number;
  verified: boolean;
  // Flag for ingredients without pricing data
  priceUnknown?: boolean;
  // Flag for cost items no longer in shopping list (preserved for manual prices)
  orphaned?: boolean;
  // Audit trail for traceability
  audit?: CostItemAudit;
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
  
  // Notes (internal: idea)
  freeformNotes: string;
  uploadedFileIds: string[];
  
  // Event Brief (internal: clarify)
  details: EventDetails;
  unknowns: string[];        // "To confirm" items
  constraints: string[];
  extractedText?: string;    // Raw OCR text from uploaded briefs
  
  // Menu Design (internal: menu)
  menu: EventMenu;
  
  // Shopping List (derived from menu, consumed by cost)
  shoppingList: ShoppingListItem[];
  
  // Execution Plan (internal: cost) - operations timeline + prep
  costBreakdown: EventCostBreakdown | null;
  operations: EventOperationsTimeline | null;
  
  // Cost Reality (internal: risk) - actual costs + risk assessment
  risks: EventRisk[];
  
  // Decision (internal: verdict)
  verdict: EventVerdict;
  verdictNotes?: string;
  verdictDate?: number;
  
  // Client Output (internal: report) - final report + invoices
  invoices?: EventInvoice[];
  
  // Folder organization
  folderId?: string | null;
};

// Event invoice for financial verification in report phase
export type EventInvoice = {
  id: string;
  name: string;
  uploadedAt: number;
  totalAmount?: number;
  vendor?: string;
  items?: Array<{
    name: string;
    quantity?: number;
    unit?: string;
    unitPrice?: number;
    total: number;
  }>;
};

export type EventFolder = {
  id: string;
  name: string;
  createdAt: number;
  isHeader?: boolean;
  parentId?: string | null;
};

// Historical price entry for learning (DIFF 9 - silent backend capture)
export type HistoricalPriceEntry = {
  id: string;
  ingredientKey: string;        // Normalized ingredient name
  ingredientOriginal: string;   // Original name as entered
  canonicalUnit: "g" | "ml" | "each";
  pricePerCanonicalUnit: number;
  currency: string;
  region?: string;
  invoiceId: string;
  invoiceVendor?: string;
  invoiceDate?: string;
  capturedAt: string;           // ISO timestamp
};


