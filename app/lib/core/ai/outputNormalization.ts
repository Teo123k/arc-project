export function humanizeReply(raw: string) {
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

  // If ARC already sounds natural and conversational, avoid over-processing
  if (!/^(FOCUS|DECISION|PLAN|NEXT|CHAT|DECISION_REVIEW)\b/m.test(text)) {
    return {
      message: text || "Hey — what's on your mind?",
      output: text || "Hey — what's on your mind?",
    };
  }

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

export function normalizeARCOutput(raw: string): string {
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


