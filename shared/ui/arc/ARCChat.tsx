"use client";

import React, { useEffect, useRef, useState } from "react";
import { synthesizeDecision } from "@/app/lib/arc/decisionSynthesis";
import { reconcileProcurement } from "@/app/lib/arc/procurementReconciliation";

type Role = "user" | "assistant";

interface ChatMessage {
  role: Role;
  content: string;
}

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

  // Internal guard to prevent repeated AI fallback
  _aiCuisineDietaryAttempted?: boolean;

  // Internal flag for classification validation
  _classificationValidated?: boolean;

  source?: "ocr" | "ai" | "user";
};

function resolveHybridRecipeName(input: {
  aiName?: string | null;
  fileName?: string | null;
  ingredients?: { name?: string }[] | null;
}): { value: string; confidence: number } {
  const clean = (s: string) =>
    s
      .replace(/\.[^/.]+$/, "") // extension
      .replace(/[_\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const titleCase = (s: string) =>
    s
      .split(" ")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(" ");

  const ai = (input.aiName || "").trim();
  if (ai.length >= 3) {
    return { value: titleCase(ai), confidence: 0.65 };
  }

  const rawFile = clean((input.fileName || "").trim());
  const file =
    rawFile &&
    !/^(img|image|photo|scan|scanned|screenshot|document|notes)\b/i.test(rawFile)
      ? rawFile
      : rawFile
      ? `Recipe from ${rawFile}`
      : "";

  const ings = (input.ingredients || [])
    .map((i) => (i?.name || "").toString().trim())
    .filter(Boolean);

  const normalizeIngredient = (s: string) => {
    // Remove leading quantities/units and common separators to get a cleaner ingredient token
    return s
      .toLowerCase()
      .replace(/^\s*\d+([\/\.\-]\d+)?\s*/g, "") // leading number or fraction-like
      .replace(/^\s*(tsp|tbsp|tablespoon|teaspoon|cup|cups|oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|kg|ml|l|liter|litre)\b\.?\s*/g, "")
      .replace(/^[\-\*\•]\s*/g, "")
      .replace(/\(.*?\)/g, " ")
      .replace(/[,;:]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const pantryStaples = new Set([
    "salt",
    "pepper",
    "water",
    "oil",
    "vegetable oil",
    "canola oil",
    "olive oil",
    "sugar",
    "flour",
    "vinegar",
    "soy sauce",
    "garlic",
    "onion",
    "butter",
  ]);

  const pickMain = () => {
    // Prefer more "dish-like" ingredient tokens (protein-ish) if present,
    // otherwise fall back to the first meaningful ingredient.
    const proteinHints = [
      "beef",
      "chicken",
      "pork",
      "lamb",
      "fish",
      "salmon",
      "tuna",
      "shrimp",
      "prawn",
      "tofu",
      "egg",
      "duck",
      "turkey",
    ];
    const normalized = ings.map((n) => normalizeIngredient(n));
    for (const hint of proteinHints) {
      const idx = normalized.findIndex((n) => n.includes(hint));
      if (idx >= 0) return ings[idx];
    }

    // Otherwise, pick the first non-staple ingredient after normalization
    const nonStapleIdx = normalized.findIndex((n) => {
      if (!n) return false;
      // Compare against staples by exact match or contained phrase
      if (pantryStaples.has(n)) return false;
      for (const staple of pantryStaples) {
        if (n === staple) return false;
      }
      return true;
    });
    if (nonStapleIdx >= 0) return ings[nonStapleIdx];

    return ings[0];
  };

  const main = pickMain();

  if (main && main.length >= 3) {
    const safeMain = normalizeIngredient(main).replace(/[^\w\s]/g, "").trim();
    return { value: titleCase(`${safeMain} Recipe`), confidence: 0.35 };
  }

  if (file) {
    return { value: titleCase(file), confidence: 0.25 };
  }

  return { value: "Untitled Recipe", confidence: 0.15 };
}

// --- Hybrid cuisine & dietary inference (rules-first) ---
function inferCuisineAndDietary(ingredients?: { name?: string }[]) {
  if (!ingredients || ingredients.length < 2) return {};

  const names = ingredients
    .map((i) => i.name?.toLowerCase() || "")
    .join(" ");

  // Cuisine rules (high confidence only)
  if (/(gochujang|doenjang|kimchi|sesame oil|soy sauce)/.test(names)) {
    return { cuisine: "Korean", cuisineConfidence: 0.7 };
  }

  if (/(olive oil|basil|parmesan|mozzarella|oregano)/.test(names)) {
    return { cuisine: "Italian", cuisineConfidence: 0.7 };
  }

  // Dietary rules (very conservative)
  const hasMeat = /(beef|chicken|pork|lamb|fish|shrimp|egg)/.test(names);
  const hasDairy = /(milk|cheese|butter|cream|yogurt)/.test(names);

  if (!hasMeat && !hasDairy) {
    return { dietary: ["vegan"], dietaryConfidence: 0.6 };
  }

  return {};
}

async function enrichCuisineDietaryWithAI(input: {
  name: string;
  ingredients: { name?: string }[];
}) {
  try {
    const prompt = `
You are a culinary assistant.

Given this recipe:
Name: ${input.name}
Ingredients: ${input.ingredients.map((i) => i.name).join(", ")}

Infer the cuisine and dietary tags ONLY if you are confident.

Respond in JSON ONLY with this shape:
{
  "cuisine": string | null,
  "dietary": string[] | null
}

If unsure, return null values.
`;

    const res = await fetch("/api/arc/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();

    // ARC chat API returns assistant message text, not parsed JSON
    const rawText =
      data?.reply ||
      data?.message ||
      data?.content ||
      data?.output ||
      "";

    if (typeof rawText !== "string") return null;

    // Attempt to parse JSON safely
    try {
      const parsed = JSON.parse(rawText);
      return parsed;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

async function validateClassificationWithAI(input: {
  name: string;
  ingredients: { name?: string }[];
}) {
  const prompt = `
You are validating a chef recipe classification.

Recipe name: ${input.name}
Ingredients: ${input.ingredients.map((i) => i.name).join(", ")}

Determine ONLY if you are confident:
- dishCategory: starter | main | dessert | other | null
- cuisine: string | null
- dietary: string[] | null

Respond ONLY in JSON:
{
  "dishCategory": string | null,
  "cuisine": string | null,
  "dietary": string[] | null,
  "confidence": number
}

If unsure, return nulls and low confidence.
`;

  const res = await fetch("/api/arc/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
  });

  const data = await res.json();
  const raw =
    data?.reply || data?.message || data?.content || data?.output || "";
  if (typeof raw !== "string") return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

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
  normalizedCosts?: NormalizedCosts;
};

interface ARCChatProps {
  uploadedFiles?: UploadedFile[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  arcState: ARCState;
  setArcState: React.Dispatch<React.SetStateAction<ARCState>>;
}

/* ---------- helpers ---------- */

function humanizeReply(raw: string) {
  if (!raw) {
    return {
      message: "",
      output: null,
    };
  }

  const clean = raw.trim();

  let text = clean
    .replace(/^(FOCUS|DECISION|PLAN|NEXT|CHAT):?/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Soften overly formal or system-like opening phrases
  text = text.replace(
    /^(Sure\.?|Certainly\.?|Of course\.?|Absolutely\.?|Let's begin\.?|Let us begin\.?|Here's the plan\.?|Here is the plan\.?)/i,
    ""
  );

  // Normalize casual human openings
  text = text.replace(/^(Hi\.?|Hello\.?|Hey\.?)\s+/i, "Hey — ");

  text = text.trim();

  // Remove common robotic openers that repeat across replies
  text = text.replace(
    /^(Alright|Okay|Sure|Let's)\b[^\n]*\n?/i,
    ""
  );

  // De-duplicate repeated sentences (exact or near-exact)
  const sentences = text.split(/(?<=[.!?])\s+/);
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const s of sentences) {
    const key = s.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(s);
    }
  }

  // Limit enumerated options to reduce over-breadth
  const numbered = deduped.filter((s) => /^\d+\.\s+/.test(s));
  if (numbered.length > 3) {
    const allowed = new Set(numbered.slice(0, 3));
    for (let i = deduped.length - 1; i >= 0; i--) {
      if (/^\d+\.\s+/.test(deduped[i]) && !allowed.has(deduped[i])) {
        deduped.splice(i, 1);
      }
    }
  }

  // Remove trailing clarification question if earlier statements exist
  if (
    deduped.length > 1 &&
    /\?$/.test(deduped[deduped.length - 1])
  ) {
    deduped.pop();
  }

  text = deduped.join(" ").trim();

  const finalOutput = text || "Hey — what's on your mind?";

  return {
    message: finalOutput,
    output: finalOutput,
  };
}

function normalizeARCOutput(raw: string): string {
  if (!raw) return "";

  try {
    let normalized = raw;

    // Clean obvious OCR noise: double spaces, broken line breaks
    normalized = normalized
      .replace(/[ \t]+/g, " ") // Multiple spaces/tabs to single space
      .replace(/\n{3,}/g, "\n\n") // Multiple newlines to double newline
      .replace(/[ \t]+\n/g, "\n") // Trailing spaces before newlines
      .replace(/\n[ \t]+/g, "\n") // Leading spaces after newlines
      .trim();

    // Ensure DECISION_REVIEW block exists, add header if missing but content suggests it
    const hasDecisionReview = /DECISION_REVIEW:/i.test(normalized);
    if (!hasDecisionReview && normalized.length > 100) {
      // If output is substantial but missing DECISION_REVIEW header,
      // check if it has section-like structure
      const hasSectionHeaders = /(?:Verdict|Financials|Operations|Risks|Next Actions):/i.test(normalized);
      if (hasSectionHeaders) {
        // Prepend DECISION_REVIEW header for better parsing
        normalized = `DECISION_REVIEW:\n\n${normalized}`;
      }
    }

    // Normalize section headers to ensure they're on their own lines
    const sectionHeaders = ["Verdict", "Financials", "Operations", "Risks & Gaps", "Next Actions", "Effort & Operations"];
    for (const header of sectionHeaders) {
      // Ensure header is followed by colon and on its own line or after space
      const regex = new RegExp(`\\b${header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!:)`, "gi");
      normalized = normalized.replace(regex, (match) => {
        return `${match}:`;
      });
    }

    // Ensure all expected sections exist (add empty ones if missing)
    // This helps Canvas 1 tabs render properly
    const expectedSections = [
      { name: "Verdict", aliases: ["Verdict"] },
      { name: "Financials", aliases: ["Financials"] },
      { name: "Operations", aliases: ["Operations", "Effort & Operations"] },
      { name: "Risks & Gaps", aliases: ["Risks & Gaps", "Risks"] },
      { name: "Next Actions", aliases: ["Next Actions", "Suggested Adjustments"] },
    ];

    // Check if DECISION_REVIEW block exists
    const reviewMatch = normalized.match(/DECISION_REVIEW:([\s\S]*)/i);
    if (reviewMatch) {
      let reviewContent = reviewMatch[1];
      
      // For each expected section, ensure it exists
      for (const section of expectedSections) {
        const hasSection = section.aliases.some((alias) => 
          new RegExp(`${alias}:`, "i").test(reviewContent)
        );
        
        // If section is missing, add it as empty
        if (!hasSection) {
          reviewContent += `\n\n${section.name}:\n(No content provided)`;
        }
      }
      
      normalized = `DECISION_REVIEW:${reviewContent}`;
    }

    return normalized;
  } catch (err) {
    // Never throw - return original if normalization fails
    console.warn("ARC output normalization failed, using original:", err);
    return raw;
  }
}

function isSourceQuery(text: string): boolean {
  const lowerText = text.toLowerCase();
  const sourcePhrases = [
    "check",
    "confirm",
    "from the file",
    "from invoice",
    "from recipe",
    "from the invoice",
    "from the recipe",
    "what does the",
    "what is in the",
    "what's in the",
    "show me from",
    "according to the",
  ];
  return sourcePhrases.some((phrase) => lowerText.includes(phrase));
}

export type NormalizedIngredientCost = {
  ingredient: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  totalPrice?: number;
  source: "recipe" | "invoice";
};

export type NormalizedCosts = {
  items: NormalizedIngredientCost[];
  missingPrices: string[];
  extraInvoiceItems: string[];
};

/* ---------- component ---------- */

export default function ARCChat({
  uploadedFiles = [],
  setUploadedFiles,
  arcState,
  setArcState,
}: ARCChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const autoSummarizedRef = useRef<string>(""); // Track which file set we've summarized
  const clarificationSentRef = useRef<string>(""); // Track which ambiguous set we've clarified

  /* keep scroll pinned */
  useEffect(() => {
    const container = bottomRef.current?.parentElement;
    if (!container) return;

    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 120;

    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  /* keep input focused */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function callARCForSourceQuery(userText: string): Promise<Response> {
    // Build file context for source query
    let fileContext = "";

    if (uploadedFiles.length > 0) {
      const roleGroups: Record<string, UploadedFile[]> = {
        recipe: [],
        invoice: [],
        event: [],
        note: [],
      };

      for (const file of uploadedFiles) {
        roleGroups[file.role].push(file);
      }

      const cleanExtractedText = (text: string | null): string => {
        if (!text) return "No text could be extracted from this file.";
        return text.replace(/\n{3,}/g, "\n\n").trim();
      };

      const referenceParts: string[] = [];

      if (roleGroups.recipe.length > 0) {
        referenceParts.push("[RECIPE DATA]");
        for (const file of roleGroups.recipe) {
          referenceParts.push(`--- ${file.name} ---`);
          referenceParts.push(cleanExtractedText(file.extractedText ?? null));
          referenceParts.push("");
        }
      }

      if (roleGroups.invoice.length > 0) {
        referenceParts.push("[INVOICE DATA]");
        for (const file of roleGroups.invoice) {
          referenceParts.push(`--- ${file.name} ---`);
          referenceParts.push(cleanExtractedText(file.extractedText ?? null));
          referenceParts.push("");
        }
      }

      if (roleGroups.event.length > 0) {
        referenceParts.push("[EVENT BRIEF]");
        for (const file of roleGroups.event) {
          referenceParts.push(`--- ${file.name} ---`);
          referenceParts.push(cleanExtractedText(file.extractedText ?? null));
          referenceParts.push("");
        }
      }

      if (roleGroups.note.length > 0) {
        referenceParts.push("[NOTES]");
        for (const file of roleGroups.note) {
          referenceParts.push(`--- ${file.name} ---`);
          referenceParts.push(cleanExtractedText(file.extractedText ?? null));
          referenceParts.push("");
        }
      }

      fileContext = `\n\n[REFERENCE MATERIAL]\n${referenceParts.join("\n")}\n[/REFERENCE MATERIAL]\n\n[SYSTEM INSTRUCTION]\nAnswer ONLY from the provided files. Do NOT produce a DECISION_REVIEW. Just answer the user's question based on the file content.\n[/SYSTEM INSTRUCTION]`;
    }

    return fetch("/api/arc/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "user", content: userText + fileContext }
        ],
      }),
    });
  }

  async function callARC(userText: string) {
    let fileContext = "";

    if (uploadedFiles.length > 0) {
      const roleGroups: Record<string, UploadedFile[]> = {
        recipe: [],
        invoice: [],
        event: [],
        note: [],
      };

      // Group files by role
      for (const file of uploadedFiles) {
        roleGroups[file.role].push(file);
      }

      // Helper to clean OCR text while preserving numbers and currency
      const cleanExtractedText = (text: string | null): string => {
        if (!text) return "No text could be extracted from this file.";
        // Remove excessive empty lines (3+ consecutive newlines) but preserve structure
        return text.replace(/\n{3,}/g, "\n\n").trim();
      };

      const referenceParts: string[] = [];

      // Build section for each role that has files
      if (roleGroups.recipe.length > 0) {
        referenceParts.push("[RECIPE DATA]");
        for (const file of roleGroups.recipe) {
          referenceParts.push(`--- ${file.name} ---`);
          referenceParts.push(cleanExtractedText(file.extractedText ?? null));
          referenceParts.push("");
        }
      }

      if (roleGroups.invoice.length > 0) {
        referenceParts.push("[INVOICE DATA]");
        for (const file of roleGroups.invoice) {
          referenceParts.push(`--- ${file.name} ---`);
          referenceParts.push(cleanExtractedText(file.extractedText ?? null));
          referenceParts.push("");
        }
      }

      if (roleGroups.event.length > 0) {
        referenceParts.push("[EVENT BRIEF]");
        for (const file of roleGroups.event) {
          referenceParts.push(`--- ${file.name} ---`);
          referenceParts.push(cleanExtractedText(file.extractedText ?? null));
          referenceParts.push("");
        }
      }

      if (roleGroups.note.length > 0) {
        referenceParts.push("[NOTES]");
        for (const file of roleGroups.note) {
          referenceParts.push(`--- ${file.name} ---`);
          referenceParts.push(cleanExtractedText(file.extractedText ?? null));
          referenceParts.push("");
        }
      }

      fileContext = `\n\n[SYSTEM INSTRUCTION]\nThe reference material below was extracted from uploaded files and is fully accessible to you. You can read and reason over this material. You must not claim that you cannot see files or that you cannot access this information. You must always produce a structured DECISION_REVIEW based on the reference material provided.\n\nYou MUST return a report with the following EXACT section headers, in this EXACT order:\n\nVerdict:\nFinancials:\nOperations:\nRisks & Gaps:\nNext Actions:\n\nDo NOT rename, merge, or omit sections.\nEvery section must contain text, even if information is missing.\nIf data is missing or unclear, explicitly state assumptions.\n[/SYSTEM INSTRUCTION]\n\n[REFERENCE MATERIAL]\n${referenceParts.join("\n")}\n[/REFERENCE MATERIAL]\n\n[SYSTEM INSTRUCTION]\nInterpret uploaded materials strictly by section:\n- RECIPE DATA defines ingredients, yields, and prep logic\n- INVOICE DATA defines actual costs and prices\n- EVENT BRIEF defines guest count, ticket price, constraints\n- NOTES define assumptions only\n\nRules:\n- Financial numbers must come ONLY from INVOICE DATA or be clearly stated assumptions\n- Never infer costs from RECIPE DATA\n- Never infer ingredients from INVOICE DATA\n- Never estimate ticket price unless stated in EVENT BRIEF\n- If data is missing or unclear, explicitly state assumptions\n[/SYSTEM INSTRUCTION]`;
    }

    return fetch("/api/arc/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "user", content: userText + fileContext }
        ],
      }),
    });
  }

  async function handleSend() {
    if (sending) return;

    const userText = input.trim();
    if (!userText) return;

    // optimistic UI
    setMessages(prev => [...prev, { role: "user", content: userText }]);
    setInput("");
    setSending(true);

    requestAnimationFrame(() => inputRef.current?.focus());

    try {
      // Check if this is a source query (file lookup question)
      const isSource = isSourceQuery(userText);

      let res: Response;
      if (isSource) {
        // For source queries, use special handler that doesn't trigger decision synthesis
        res = await callARCForSourceQuery(userText);
      } else {
        // Regular flow with decision synthesis
        res = await callARC(userText);
      }

      // 🔁 ONE safe retry for dev-mode 404 / 405
      if (!res.ok && (res.status === 404 || res.status === 405)) {
        await new Promise(r => setTimeout(r, 300));
        res = isSource
          ? await callARCForSourceQuery(userText)
          : await callARC(userText);
      }

      if (!res.ok) {
        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            content:
              "I briefly lost connection. Say that again and we'll continue.",
          },
        ]);
        return;
      }

      const data = await res.json().catch(() => ({}));
      const raw = String(data?.reply ?? "");

      // For source queries, return answer directly without decision synthesis
      if (isSource) {
        const answer = humanizeReply(raw).message;
        setMessages(prev => [...prev, { role: "assistant", content: answer }]);
        return;
      }

      // Regular flow: normalize, synthesize decision, update state
      console.log("ARC RAW OUTPUT >>>", raw);

      // Normalize output for better parsing (non-breaking, best-effort)
      const normalized = normalizeARCOutput(raw);

      // Synthesize structured decision from DECISION_REVIEW
      const decision = synthesizeDecision({ arcReply: normalized });

      // DEBUG: Inspect runtime data
      console.log("[ARC DEBUG] Raw ARC reply:", raw);
      console.log("[ARC DEBUG] Synthesized decision:", decision);
      console.log("[ARC DEBUG] Decision sections:", decision?.sections);
      console.log("[ARC DEBUG] Sections.operations:", decision?.sections?.operations);
      console.log("[ARC DEBUG] Sections.risksAndGaps:", decision?.sections?.risksAndGaps);
      console.log("[ARC DEBUG] Sections.nextActions:", decision?.sections?.nextActions);

      // If decision was synthesized, show short message in chat instead of full reply
      const chatMessage =
        decision && decision.verdict !== "UNKNOWN"
          ? "Decision generated. See Canvas for details."
          : humanizeReply(raw).message;

      // Update parent state with decision (use normalized output for consistency)
      setArcState({
        arcOutput: normalized || null,
        decision: decision ?? undefined,
      });

      setMessages(prev => [...prev, { role: "assistant", content: chatMessage }]);
    } catch (err) {
      console.error("ARC chat error:", err);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content:
            "Something briefly interrupted me. Let’s keep going.",
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  /* normalize ingredient costs when files change */
  useEffect(() => {
    if (uploadedFiles.length === 0) {
      if (arcState.normalizedCosts) {
        setArcState((prev) => ({ ...prev, normalizedCosts: undefined }));
      }
      return;
    }

    const hasExtractedText = uploadedFiles.some(
      (f) => f.extractedText && f.extractedText.length > 0
    );

    if (!hasExtractedText) return;

    // ===============================
    // STEP B: Recipe Intelligence (non-OCR, non-UI)
    // ===============================
    const enrichedRecipes = uploadedFiles.map((file) => {
      if (file.role !== "recipe" || !file.extractedText) return file;

      const text = file.extractedText.toLowerCase();

      // naive but safe heuristics (AI refinement later)
      const nameMatch =
        text.match(/recipe[:\-]\s*(.+)/i) ||
        text.match(/title[:\-]\s*(.+)/i);

      const dishStyle =
        /soup|broth/.test(text)
          ? "soup"
          : /salad/.test(text)
          ? "salad"
          : /grill|grilled/.test(text)
          ? "grilled"
          : /fried/.test(text)
          ? "fried"
          : "unspecified";

      const category =
        /dessert|cake|sweet/.test(text)
          ? "dessert"
          : /starter|appetizer|entrée/.test(text)
          ? "starter"
          : "main";

      return {
        ...file,
        recipeIntelligence: {
          ...file.recipeIntelligence,
          // Legacy extraction mapped to canonical fields (non-destructive)
          recipeName:
            file.recipeIntelligence?.recipeName ??
            nameMatch?.[1]?.trim() ??
            file.name,

          dishCategory:
            file.recipeIntelligence?.dishCategory ?? category,

          dishStyle:
            file.recipeIntelligence?.dishStyle ?? dishStyle,
        },
      };
    });

    // overwrite only when enrichment is possible
    if (enrichedRecipes !== uploadedFiles) {
      setArcState((prev) => prev); // no ARC mutation
    }

    const recipeFiles = uploadedFiles.filter((f) => f.role === "recipe");
    const invoiceFiles = uploadedFiles.filter((f) => f.role === "invoice");

    if (recipeFiles.length === 0 && invoiceFiles.length === 0) return;

    const reconciliation = reconcileProcurement({
      recipeFiles: recipeFiles.map((f) => ({ extractedText: f.extractedText ?? null })),
      invoiceFiles: invoiceFiles.map((f) => ({ extractedText: f.extractedText ?? null })),
    });

    const normalizedCosts: NormalizedCosts = {
      items: reconciliation.financialLines.map((line) => ({
        ingredient: line.recipeIngredient,
        quantity: line.recipeQty,
        unit: line.recipeUnit,
        unitPrice: line.unitPrice,
        totalPrice: line.totalPrice,
        source: "recipe" as const,
      })),
      missingPrices: reconciliation.missingIngredients,
      extraInvoiceItems: reconciliation.extraInvoiceItems,
    };

    setArcState((prev) => ({ ...prev, normalizedCosts }));

    if (reconciliation.ambiguousIngredients.length > 0 && !sending) {
      const ambiguousFingerprint = reconciliation.ambiguousIngredients.sort().join("|");
      if (clarificationSentRef.current !== ambiguousFingerprint) {
        clarificationSentRef.current = ambiguousFingerprint;
        
        const ambiguousLines = reconciliation.financialLines.filter(line => line.status === "ambiguous");
        const clarificationMessages = ambiguousLines.map(line => {
          const confidencePercent = Math.round(line.confidence * 100);
          const invoiceItemName = line.invoiceMatch?.ingredient || "unknown item";
          return `Quick check:\nFor ${line.recipeIngredient} in your recipe,\nI think it matches "${invoiceItemName}" on the invoice\n(about ${confidencePercent}% confidence).\n\nIs this correct?`;
        });
        
        setMessages((prev) => {
          const hasClarification = prev.some(
            (m) => m.role === "assistant" && m.content.includes("Quick check:")
          );
          if (hasClarification) return prev;
          return [...prev, ...clarificationMessages.map(content => ({ role: "assistant" as const, content }))];
        });
      }
    } else if (reconciliation.ambiguousIngredients.length === 0) {
      clarificationSentRef.current = "";
    }
  }, [uploadedFiles, sending]); // Only re-run when files change

  // Step E/F unified: enrich recipeIntelligence directly on uploadedFiles (single source of truth)
  useEffect(() => {
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    const pending = uploadedFiles.filter(
      (f) =>
        f.role === "recipe" &&
        !!f.extractedText &&
        (!f.recipeIntelligence?.recipeName || f.recipeIntelligence?.needsReview)
    );

    if (pending.length === 0) return;

    pending.forEach((file) => {
      const prompt = `
You are extracting structured data from a chef recipe.

Return STRICT JSON only (no markdown, no explanation).

Schema:
{
  "recipeName": string,
  "dishCategory": "starter" | "main" | "dessert" | "other",
  "dishStyle": string,
  "cuisine": string,
  "dietary": string[]
}

Rules:
- If unsure, leave field empty and set needsReview=true.
- Never invent a recipe name if the text is not enough.

Recipe text:
${file.extractedText}
`;

      callARCForSourceQuery(prompt)
        .then(async (res) => {
          if (!res.ok) return null;
          return res.json().catch(() => null);
        })
        .then((data) => {
          const raw = data?.reply ? String(data.reply) : "";
          if (!raw) return;

          let parsed: any = null;
          try {
            parsed = JSON.parse(raw);
          } catch {
            // If the model wrapped JSON in text, attempt to recover the first JSON object.
            const m = raw.match(/\{[\s\S]*\}/);
            if (!m) return;
            try {
              parsed = JSON.parse(m[0]);
            } catch {
              return;
            }
          }

          const recipeName =
            typeof parsed?.recipeName === "string" ? parsed.recipeName.trim() : "";
          const dishCategory =
            typeof parsed?.dishCategory === "string" ? parsed.dishCategory : undefined;
          const dishStyle =
            typeof parsed?.dishStyle === "string" ? parsed.dishStyle.trim() : "";
          const cuisine =
            typeof parsed?.cuisine === "string" ? parsed.cuisine.trim() : "";
          const dietary =
            Array.isArray(parsed?.dietary) ? parsed.dietary.filter((x: any) => typeof x === "string") : [];

          const needsReview = !recipeName;

          setUploadedFiles((prev) =>
            prev.map((f) => {
              if (f.name !== file.name || f.size !== file.size) return f;

              const resolvedName = resolveHybridRecipeName({
                aiName: recipeName,
                fileName: f.name,
                ingredients: parsed?.ingredients,
              });

              // Hybrid cuisine/dietary inference (rules-first)
              const inferred = inferCuisineAndDietary(parsed?.ingredients);

              const baseLifecycleState: any = (() => {
                if (
                  parsed?.cuisine ||
                  parsed?.dishStyle ||
                  parsed?.dishCategory
                ) {
                  return "enriched";
                }
                if (parsed?.ingredients?.length) {
                  return "parsed";
                }
                return "discovered";
              })();

              const clarificationQuestions: any[] = (() => {
                const hasYieldOrServings =
                  parsed?.yield != null ||
                  parsed?.servings != null ||
                  parsed?.yieldServings != null;
                const looksLikeARealRecipe = Boolean(parsed?.ingredients?.length >= 2);

                if (looksLikeARealRecipe && !hasYieldOrServings) {
                  return [
                    {
                      id: `${f.name}-${f.size}-yield-servings`,
                      field: "yieldServings",
                      question: "About how many portions does this recipe make?",
                      options: ["2–4", "5–8", "9–12", "12+"],
                      priority: 1,
                      status: "open" as const,
                    },
                  ];
                }
                return [];
              })();

              const lifecycleState: any =
                clarificationQuestions.length > 0 ? "needs_clarification" : baseLifecycleState;

              return {
                ...f,
                recipeIntelligence: {
                  ...f.recipeIntelligence,
                  lifecycleState,

                  // Legacy flat fields
                  recipeName: resolvedName.value,
                  dishCategory: dishCategory,
                  dishStyle: dishStyle,
                  cuisine: cuisine || inferred.cuisine,
                  dietary: dietary || inferred.dietary,

                  // New structured fields (non-breaking, internal use)
                  recipeNameStructured: {
                    value: resolvedName.value,
                    confidence: resolvedName.confidence,
                    source: recipeName ? "ai" : "derived",
                  } as any,

                  dishCategoryStructured: dishCategory
                    ? {
                        value: dishCategory,
                        confidence: 0.5,
                      }
                    : undefined,

                  dishStyleStructured: dishStyle
                    ? { value: dishStyle, confidence: 0.4 }
                    : undefined,
                  cuisineStructured: cuisine
                    ? { value: cuisine, confidence: 0.4 }
                    : inferred.cuisine
                    ? { value: inferred.cuisine, confidence: inferred.cuisineConfidence }
                    : undefined,
                  dietaryStructured: dietary?.length
                    ? { value: dietary, confidence: 0.4 }
                    : inferred.dietary
                    ? { value: inferred.dietary, confidence: inferred.dietaryConfidence }
                    : undefined,

                  ingredients: parsed?.ingredients?.map((ing: any) => ({
                    ...ing,
                    confidence: 0.4,
                  })),

                  completeness: (() => {
                    const chefUsable =
                      Boolean(resolvedName.value) && Boolean(parsed?.ingredients?.length >= 2);

                    // Costing readiness stays conservative for now
                    const costingReady = false;

                    return { chefUsable, costingReady };
                  })(),

                  // Internal clarification queue (no UX yet)
                  clarificationQuestions,

                  source: "ai",
                },
              };
            })
          );
        });
    });
  }, [uploadedFiles, setUploadedFiles]);

  // AI fallback for cuisine/dietary when rules fail
  useEffect(() => {
    uploadedFiles.forEach(async (file) => {
      const intel = file.recipeIntelligence;
      if (!intel) return;

      // Guardrails: only fallback when safe
      if (
        intel.completeness?.chefUsable !== true ||
        intel.cuisineStructured ||
        intel.dietaryStructured ||
        !intel.ingredients ||
        intel.ingredients.length < 3 ||
        intel._aiCuisineDietaryAttempted
      ) {
        return;
      }

      const aiResult = await enrichCuisineDietaryWithAI({
        name: intel.recipeName || "",
        ingredients: intel.ingredients,
      });

      if (!aiResult) return;

      setUploadedFiles((prev) =>
        prev.map((f) => {
          if (f.name !== file.name || f.size !== file.size) return f;

          return {
            ...f,
            recipeIntelligence: {
              ...f.recipeIntelligence,

              cuisine:
                f.recipeIntelligence?.cuisine ?? aiResult.cuisine ?? undefined,
              dietary:
                f.recipeIntelligence?.dietary ?? aiResult.dietary ?? undefined,

              cuisineStructured:
                f.recipeIntelligence?.cuisineStructured ??
                (aiResult.cuisine
                  ? { value: aiResult.cuisine, confidence: 0.6 }
                  : undefined),

              dietaryStructured:
                f.recipeIntelligence?.dietaryStructured ??
                (aiResult.dietary
                  ? { value: aiResult.dietary, confidence: 0.6 }
                  : undefined),

              _aiCuisineDietaryAttempted: true,
            },
          };
        })
      );
    });
  }, [uploadedFiles]);

  // ===============================
  // STEP G: Classification Validation (AI, second pass)
  // ===============================
  useEffect(() => {
    uploadedFiles.forEach(async (file) => {
      const intel = file.recipeIntelligence;
      if (!intel) return;

      if (
        intel._classificationValidated ||
        intel.completeness?.chefUsable !== true ||
        !intel.ingredients ||
        intel.ingredients.length < 2 ||
        intel.lifecycleState === "user_confirmed"
      ) {
        return;
      }

      const result = await validateClassificationWithAI({
        name: intel.recipeName || "",
        ingredients: intel.ingredients,
      });

      if (!result || result.confidence < 0.6) {
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.name === file.name && f.size === file.size
              ? {
                  ...f,
                  recipeIntelligence: {
                    ...f.recipeIntelligence,
                    _classificationValidated: true,
                  },
                }
              : f
          )
        );
        return;
      }

      setUploadedFiles((prev) =>
        prev.map((f) => {
          if (f.name !== file.name || f.size !== file.size) return f;

          return {
            ...f,
            recipeIntelligence: {
              ...f.recipeIntelligence,

              dishCategory:
                result.dishCategory ?? f.recipeIntelligence?.dishCategory,
              cuisine:
                result.cuisine ?? f.recipeIntelligence?.cuisine,
              dietary:
                result.dietary ?? f.recipeIntelligence?.dietary,

              dishCategoryStructured: result.dishCategory
                ? { value: result.dishCategory, confidence: result.confidence }
                : f.recipeIntelligence?.dishCategoryStructured,

              cuisineStructured: result.cuisine
                ? { value: result.cuisine, confidence: result.confidence }
                : f.recipeIntelligence?.cuisineStructured,

              dietaryStructured: result.dietary
                ? { value: result.dietary, confidence: result.confidence }
                : f.recipeIntelligence?.dietaryStructured,

              _classificationValidated: true,
            },
          };
        })
      );
    });
  }, [uploadedFiles]);

  /* auto-summarize uploaded files */
  useEffect(() => {
    // Skip if no files, already has decision, or sending is in progress
    if (uploadedFiles.length === 0 || arcState?.decision || sending) return;

    // Create a fingerprint of current file set to avoid re-summarizing
    const fileFingerprint = uploadedFiles
      .map((f) => `${f.name}-${f.size}`)
      .sort()
      .join("|");

    // Skip if we've already summarized this exact file set
    if (autoSummarizedRef.current === fileFingerprint) return;

    // Check if any files have extracted text
    const hasExtractedText = uploadedFiles.some(
      (f) => f.extractedText && f.extractedText.length > 0
    );

    if (!hasExtractedText) return; // Wait for text extraction

    // Mark as summarized before starting (prevent race conditions)
    autoSummarizedRef.current = fileFingerprint;

    // Auto-summarize asynchronously (don't block UI)
    (async () => {
      try {
        const summaryPrompt = "Summarise the uploaded files clearly and concisely. Focus on key facts, numbers, and assumptions. Do not ask questions.";

        const res = await callARC(summaryPrompt);

        if (!res.ok) return; // Silently fail if API error

        const data = await res.json().catch(() => ({}));
        const raw = String(data?.reply ?? "");

        if (!raw) return;

        // Normalize output for better parsing
        const normalized = normalizeARCOutput(raw);

        // Synthesize decision (may or may not succeed, that's OK)
        const decision = synthesizeDecision({ arcReply: normalized });

        // Update state ONLY (no chat message)
        // normalizedCosts is handled by useEffect when files change
        setArcState({
          arcOutput: normalized || null,
          decision: decision ?? undefined,
        });
      } catch (err) {
        // Silently fail - don't break user experience
        console.warn("Auto-summarization failed:", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedFiles, arcState.decision, sending]); // callARC is stable, fingerprint prevents loops

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto flex flex-col px-1 text-[13px]">
        <div className="flex-1" />

        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-1.5 rounded max-w-[85%] mb-2 whitespace-pre-line ${
              m.role === "user"
                ? "self-end bg-[#D8C5A3] text-black"
                : "self-start bg-[#F8F1E6] text-[#6B5538] text-[12px] opacity-80"
            }`}
          >
            {m.content}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      <textarea
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        rows={2}
        className="border rounded p-2 mt-3 text-black resize-none min-h-[48px] max-h-[160px] overflow-y-auto"
        placeholder={sending ? "ARC is thinking..." : "Talk to ARC..."}
      />
    </div>
  );
}