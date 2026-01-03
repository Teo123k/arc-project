"use client";

import React, { useEffect, useRef, useState } from "react";
import { synthesizeDecision } from "@/app/lib/arc/decisionSynthesis";
import { reconcileProcurement } from "@/app/lib/arc/procurementReconciliation";
import { resolveCanonicalRecipe, type CanonicalRecipe } from "@/app/lib/arc/recipe/resolveCanonicalRecipe";
import { computeServingsFromIngredients } from "@/app/lib/arc/recipe/servingsFromIngredients";
import { humanizeReply, normalizeARCOutput } from "@/app/lib/core/ai/outputNormalization";
import type { EventDetails } from "@/app/lib/core/shared/types";
import {
  buildCuisineDietaryPrompt,
  buildStructuredRecipeExtractionPrompt,
  buildValidateClassificationPrompt,
  extractStructuredRecipeFields,
  getEnrichmentFileKey,
  isCoolingDown as isCoolingDownMap,
  noteFailure as noteFailureMaps,
  parseJsonObjectFromReply,
  parseStrictJsonFromReply,
} from "@/app/lib/core/ai/enrichmentPipeline";

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
  needsReview?: boolean;

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
  occasionStructured?: { value: string; confidence: number; source?: "ocr" | "ai" | "user" };

  ingredients?: {
    name: string;
    quantity?: number;
    unit?: string;
    confidence?: number;
    quantityInferred?: boolean;
    unitInferred?: boolean;
    category?: "fresh" | "dry" | "other";
  }[];

  steps?: {
    order: number;
    instruction: string;
    confidence?: number;
  }[];

  servingsAnalysis?: {
    servings: number | null;
    assumption: "standalone_main_dinner";
    limitingIngredient?: string;
    notes: string[];
    usedInferredQuantities: boolean;
  };

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

  // Prevent repeated enrichment calls once we've extracted structured fields at least once
  _structuredExtractedAt?: number;
  _structuredExtractVersion?: number;

  source?: "ocr" | "ai" | "user";
};

function normalizeOcrRecipeText(raw: string): string {
  if (!raw) return "";
  const lines = raw
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const isNumberOnly = (s: string) => /^(\d+(\.\d+)?|\d+\/\d+)$/.test(s);
  const isUnitOnly = (s: string) =>
    /^(g|kg|mg|ml|l|tsp|tbsp|cup|cups|oz|lb|lbs|pcs|pc|piece|pieces)$/.test(
      s.toLowerCase().replace(/\./g, "")
    );

  const merged: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const a = lines[i];
    const b = lines[i + 1];
    const c = lines[i + 2];

    // Merge common OCR fragmentation: "1" + "cup" + "chana daal"
    if (a && b && c && isNumberOnly(a) && isUnitOnly(b) && !isNumberOnly(c) && !isUnitOnly(c)) {
      merged.push(`${a} ${b} ${c}`.trim());
      i += 2;
      continue;
    }

    // Merge "1" + "chana daal" (unit missing)
    if (a && b && isNumberOnly(a) && !isNumberOnly(b) && !isUnitOnly(b)) {
      merged.push(`${a} ${b}`.trim());
      i += 1;
      continue;
    }

    merged.push(a);
  }

  return merged.join("\n");
}

function headTailText(raw: string, maxChars: number): string {
  if (!raw) return "";
  if (raw.length <= maxChars) return raw;
  const headChars = Math.floor(maxChars * 0.6);
  const tailChars = Math.max(0, maxChars - headChars);
  const head = raw.slice(0, headChars);
  const tail = tailChars > 0 ? raw.slice(-tailChars) : "";
  return `${head}\n\n…\n\n${tail}`;
}

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
    const prompt = buildCuisineDietaryPrompt(input);

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
    return parseStrictJsonFromReply(rawText);
  } catch {
    return null;
  }
}

async function validateClassificationWithAI(input: {
  name: string;
  ingredients: { name?: string }[];
}) {
  const prompt = buildValidateClassificationPrompt(input);

  const res = await fetch("/api/arc/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
  });

  const data = await res.json();
  const raw =
    data?.reply || data?.message || data?.content || data?.output || "";
  if (typeof raw !== "string") return null;

  return parseStrictJsonFromReply(raw);
}

type UploadedFile = {
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
  // If false (default), ARCChat must not proactively inject assistant "check"/question messages.
  allowAutoClarifications?: boolean;
  // Optional: allow chat to update the current event brief (non-blocking) using existing extract-event-details.
  eventContext?: {
    name: string;
    details: EventDetails;
    unknowns?: string[];
    constraints?: string[];
    freeformNotes?: string;
  };
  onUpdateEventContext?: (updates: {
    details?: EventDetails;
    unknowns?: string[];
    constraints?: string[];
    freeformNotes?: string;
  }) => void;
}

/* ---------- helpers ---------- */

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
  allowAutoClarifications = false,
  eventContext,
  onUpdateEventContext,
}: ARCChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const autoSummarizedRef = useRef<string>(""); // Track which file set we've summarized
  const clarificationSentRef = useRef<string>(""); // Track which ambiguous set we've clarified

  // Prevent runaway enrichment / rate-limit spam
  const inFlightRef = useRef<Map<string, boolean>>(new Map());
  const cooldownUntilRef = useRef<Map<string, number>>(new Map());
  const backoffMsRef = useRef<Map<string, number>>(new Map());
  const lastErrorLogAtRef = useRef<Map<string, number>>(new Map());

  const getFileKey = (file: UploadedFile, kind: "enrich" | "cuisine") =>
    getEnrichmentFileKey(file, kind);

  const isCoolingDown = (key: string) => {
    return isCoolingDownMap(cooldownUntilRef.current, key);
  };

  const noteFailure = (key: string, err: unknown, retryAfterMs?: number) => {
    return noteFailureMaps({
      key,
      err,
      retryAfterMs,
      lastErrorLogAt: lastErrorLogAtRef.current,
      backoffMs: backoffMsRef.current,
      cooldownUntil: cooldownUntilRef.current,
    });
  };

  const eventContextRef = useRef<typeof eventContext | null>(null);
  const onUpdateEventContextRef = useRef<typeof onUpdateEventContext | null>(null);

  useEffect(() => {
    eventContextRef.current = eventContext ?? null;
  }, [eventContext]);

  useEffect(() => {
    onUpdateEventContextRef.current = onUpdateEventContext ?? null;
  }, [onUpdateEventContext]);

  async function maybeUpdateEventBriefFromChatText(userText: string) {
    const ctx = eventContextRef.current;
    const updater = onUpdateEventContextRef.current;
    if (!ctx || !updater) return;

    try {
      const res = await fetch("/api/arc/extract-event-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: userText,
          existingDetails: ctx.details,
        }),
      });
      if (!res.ok) return;

      const data = await res.json().catch(() => null);
      if (!data || typeof data !== "object") return;

      const details = (data as any).details;
      const unknowns = (data as any).unknowns;
      const constraints = (data as any).constraints;

      const nextDetails =
        details && typeof details === "object" ? { ...ctx.details, ...details } : ctx.details;

      const nextUnknowns = Array.from(
        new Set<string>([
          ...((ctx.unknowns ?? []) as string[]),
          ...(Array.isArray(unknowns) ? unknowns : []),
        ])
      );

      const nextConstraints = Array.from(
        new Set<string>([
          ...((ctx.constraints ?? []) as string[]),
          ...(Array.isArray(constraints) ? constraints : []),
        ])
      );

      updater({
        details: nextDetails,
        unknowns: nextUnknowns,
        constraints: nextConstraints,
      });
    } catch {
      // Non-blocking: ignore failures.
    }
  }

  function maybeAppendEventNotesFromChatText(userText: string) {
    const ctx = eventContextRef.current;
    const updater = onUpdateEventContextRef.current;
    if (!ctx || !updater) return;

    const trimmed = (userText || "").trim();
    if (!trimmed) return;

    const existing = (ctx.freeformNotes || "").trim();
    // Avoid duplicating the exact same line repeatedly.
    if (existing.includes(trimmed)) return;

    const next = existing ? `${existing}\n\n${trimmed}` : trimmed;
    updater({ freeformNotes: next });
  }

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
      // Non-blocking: attempt to update the current event brief from user chat (if context is provided).
      void maybeUpdateEventBriefFromChatText(userText);
      // Non-blocking: capture chef chat input as notes on the current event (if context is provided).
      maybeAppendEventNotesFromChatText(userText);

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

    if (!allowAutoClarifications) {
      clarificationSentRef.current = "";
      return;
    }

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

    const STRUCTURED_EXTRACT_VERSION = 3;

    const pending = uploadedFiles.filter((f) => {
      if (f.role !== "recipe") return false;
      if (!f.extractedText) return false;
      // Versioned: re-parse existing recipes once when schema changes
      if ((f.recipeIntelligence?._structuredExtractVersion ?? 0) >= STRUCTURED_EXTRACT_VERSION) {
        return false;
      }

      const key = getFileKey(f, "enrich");
      if (inFlightRef.current.get(key)) return false;
      if (isCoolingDown(key)) return false;

      return true;
    });

    if (pending.length === 0) return;

    // Serialize enrichment to 1 file at a time to avoid rate-limit bursts
    const file = pending[0];
    const key = getFileKey(file, "enrich");
    inFlightRef.current.set(key, true);

    // Use head+tail so we keep the end of the recipe (where steps often live).
    // Still capped to limit token pressure and rate limiting.
    const maxChars = 24_000;
    const recipeText =
      typeof file.extractedText === "string"
        ? headTailText(normalizeOcrRecipeText(file.extractedText), maxChars)
        : "";

    const prompt = buildStructuredRecipeExtractionPrompt(recipeText);

    (async () => {
      try {
        const res = await callARCForSourceQuery(prompt);
        if (!res.ok) {
          const retryAfterMsRaw = res.headers.get("retry-after-ms");
          const retryAfterMs = retryAfterMsRaw ? Number(retryAfterMsRaw) : undefined;
          noteFailure(key, `HTTP ${res.status}`, retryAfterMs);
          return;
        }

        const data = await res.json().catch(() => null);
        const raw = data?.reply ? String(data.reply) : "";
        if (!raw) return;

        const parsed = parseJsonObjectFromReply(raw);
        if (!parsed) return;

        const extracted = extractStructuredRecipeFields(parsed);
        const recipeName = extracted.recipeName;
        const dishCategory = extracted.dishCategory;
        const dishStyle = extracted.dishStyle;
        const cuisine = extracted.cuisine;
        const dietary = extracted.dietary;

        // servingsText currently unused; kept for forward compatibility
        const _servingsText = extracted.servingsText;

        const ingredients = extracted.ingredients as RecipeIntelligence["ingredients"];
        const steps = extracted.steps as RecipeIntelligence["steps"];

        setUploadedFiles((prev) =>
          prev.map((f) => {
            const sameFile =
              f.id && (file as any).id
                ? f.id === (file as any).id
                : f.name === file.name && f.size === file.size;
            if (!sameFile) return f;

            const resolvedName = resolveHybridRecipeName({
              aiName: recipeName,
              fileName: f.name,
              ingredients: parsed?.ingredients,
            });

            const inferred = inferCuisineAndDietary(parsed?.ingredients);

            const baseLifecycleState: any = (() => {
              if (parsed?.cuisine || parsed?.dishStyle || parsed?.dishCategory) return "enriched";
              if (parsed?.ingredients?.length) return "parsed";
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

            const nextRecipeIntelligence: RecipeIntelligence = {
              ...f.recipeIntelligence,
              lifecycleState,
              needsReview: false,
              _structuredExtractedAt: Date.now(),
              _structuredExtractVersion: STRUCTURED_EXTRACT_VERSION,
              recipeName: resolvedName.value,
              dishCategory: dishCategory,
              dishStyle: dishStyle,
              cuisine: cuisine || inferred.cuisine,
              recipeNameStructured: {
                value: resolvedName.value,
                confidence: resolvedName.confidence,
                source: recipeName ? "ai" : "ocr",
              } as any,
              dishCategoryStructured: dishCategory
                ? { value: dishCategory, confidence: 0.5 }
                : undefined,
              occasionStructured: dishCategory
                ? { value: dishCategory, confidence: 0.6, source: "ai" }
                : undefined,
              dishStyleStructured: dishStyle ? { value: dishStyle, confidence: 0.4 } : undefined,
              cuisineStructured: cuisine
                ? { value: cuisine, confidence: 0.4 }
                : inferred.cuisine
                ? { value: inferred.cuisine, confidence: inferred.cuisineConfidence }
                : undefined,
              dietary: dietary?.length ? dietary : inferred.dietary?.length ? inferred.dietary : undefined,
              dietaryStructured: dietary?.length
                ? { value: dietary, confidence: 0.4 }
                : inferred.dietary
                ? { value: inferred.dietary, confidence: inferred.dietaryConfidence }
                : undefined,
              ingredients: ingredients ?? [],
              steps: steps ?? [],
              servingsAnalysis: computeServingsFromIngredients({
                ingredients: (ingredients ?? []).map((i) => ({
                  name: i.name,
                  quantity: i.quantity ?? null,
                  unit: i.unit ?? null,
                  quantityInferred: i.quantityInferred,
                  unitInferred: i.unitInferred,
                })),
              }),
              completeness: (() => {
                const chefUsable =
                  Boolean(resolvedName.value) &&
                  Boolean((ingredients?.length ?? 0) >= 2) &&
                  Boolean((steps?.length ?? 0) >= 2);
                const costingReady = false;
                return { chefUsable, costingReady };
              })(),
              clarificationQuestions,
              source: "ai",
            };

            const canonicalRecipe = resolveCanonicalRecipe({
              id: f.id || `${f.name}-${f.size}-${f.lastModified ?? 0}`,
              extractedText: f.extractedText ?? null,
              recipeIntelligence: nextRecipeIntelligence as any,
              fallbackTitle: nextRecipeIntelligence.recipeName ?? f.name,
            });

            return {
              ...f,
              recipeIntelligence: nextRecipeIntelligence,
              canonicalRecipe,
            };
          })
        );

        // success: clear backoff/cooldown
        backoffMsRef.current.delete(key);
        cooldownUntilRef.current.delete(key);
      } catch (err) {
        noteFailure(key, err);
      } finally {
        inFlightRef.current.delete(key);
      }
    })();
  }, [uploadedFiles, setUploadedFiles]);

  // AI fallback for cuisine/dietary when rules fail
  useEffect(() => {
    const file = uploadedFiles.find((f) => {
      const intel = f.recipeIntelligence;
      if (!intel) return false;

      if (
        intel.completeness?.chefUsable !== true ||
        intel.cuisineStructured ||
        intel.dietaryStructured ||
        !intel.ingredients ||
        intel.ingredients.length < 3 ||
        intel._aiCuisineDietaryAttempted
      ) {
        return false;
      }

      const key = getFileKey(f, "cuisine");
      if (inFlightRef.current.get(key)) return false;
      if (isCoolingDown(key)) return false;
      return true;
    });

    if (!file) return;

    (async () => {
      const key = getFileKey(file, "cuisine");
      inFlightRef.current.set(key, true);
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

      try {
        const aiResult = await enrichCuisineDietaryWithAI({
          name: intel.recipeName || "",
          ingredients: intel.ingredients,
        });

        if (!aiResult) return;

        setUploadedFiles((prev) =>
          prev.map((f) => {
            const sameFile =
              f.id && (file as any).id
                ? f.id === (file as any).id
                : f.name === file.name && f.size === file.size;
            if (!sameFile) return f;

            const nextRecipeIntelligence: RecipeIntelligence = {
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
            };

            const canonicalRecipe = resolveCanonicalRecipe({
              id: f.id || `${f.name}-${f.size}-${f.lastModified ?? 0}`,
              extractedText: f.extractedText ?? null,
              recipeIntelligence: nextRecipeIntelligence as any,
              fallbackTitle: nextRecipeIntelligence.recipeName ?? f.name,
            });

            return {
              ...f,
              recipeIntelligence: nextRecipeIntelligence,
              canonicalRecipe,
            };
          })
        );

        backoffMsRef.current.delete(key);
        cooldownUntilRef.current.delete(key);
      } catch (err) {
        noteFailure(key, err);
      } finally {
        inFlightRef.current.delete(key);
      }
    })();
  }, [uploadedFiles]);

  /* auto-summarize uploaded files */
  useEffect(() => {
    // Skip if no files, already has decision, or sending is in progress
    if (uploadedFiles.length === 0 || arcState?.decision || sending) return;

    // Create a fingerprint of current file set to avoid re-summarizing
    const fileFingerprint = uploadedFiles
      .map((f) => f.id || `${f.name}-${f.size}`)
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