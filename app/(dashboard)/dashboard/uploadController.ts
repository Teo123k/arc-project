import type { Dispatch, SetStateAction } from "react";
import type { CanonicalRecipe } from "@/app/lib/arc/recipe/resolveCanonicalRecipe";
import type { InvoiceIntelligence, UploadedFile } from "@/app/lib/core/shared/types";

type ResolveCanonicalRecipe = (input: {
  id: string;
  extractedText?: string | null;
  fallbackTitle?: string;
}) => CanonicalRecipe;

export async function triggerRoleUpload(input: {
  role: UploadedFile["role"];
  resolveCanonicalRecipe: ResolveCanonicalRecipe;
  setExtractingFiles: Dispatch<SetStateAction<boolean>>;
  setUploadedFiles: Dispatch<SetStateAction<UploadedFile[]>>;
}) {
  const { role, resolveCanonicalRecipe, setExtractingFiles, setUploadedFiles } = input;

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.multiple = true;
  fileInput.accept = "image/*,.pdf,.txt,.md,.csv,text/csv";

  fileInput.onchange = async () => {
    if (!fileInput.files || fileInput.files.length === 0) return;

    const files = Array.from(fileInput.files);
    setExtractingFiles(true);

    const newFiles: UploadedFile[] = [];

    for (const file of files) {
      const id = `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`;
      // Text files: extract locally
      if (file.type === "text/plain" || file.name.endsWith(".md")) {
        try {
          const text = await file.text();
          const canonicalRecipe =
            role === "recipe"
              ? resolveCanonicalRecipe({
                  id,
                  extractedText: text,
                  fallbackTitle: file.name,
                })
              : undefined;
          newFiles.push({
            id,
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified,
            role,
            extractedText: text,
            extractionMethod: "text",
            canonicalRecipe,
            recipeIntelligence:
              role === "recipe"
                ? {
                    needsReview: true,
                    confidence: "low",
                    source: "ocr",
                  }
                : undefined,
          });
        } catch {
          const canonicalRecipe =
            role === "recipe"
              ? resolveCanonicalRecipe({
                  id,
                  extractedText: null,
                  fallbackTitle: file.name,
                })
              : undefined;
          newFiles.push({
            id,
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified,
            role,
            extractedText: null,
            extractionMethod: "text",
            extractionError: "Failed to read text file",
            canonicalRecipe,
            recipeIntelligence:
              role === "recipe"
                ? {
                    needsReview: true,
                    confidence: "low",
                    source: "ocr",
                  }
                : undefined,
          });
        }
        continue;
      }

      // CSV: parse locally (no OCR)
      if (file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv")) {
        try {
          const text = await file.text();
          const canonicalRecipe =
            role === "recipe"
              ? resolveCanonicalRecipe({
                  id,
                  extractedText: text,
                  fallbackTitle: file.name,
                })
              : undefined;
          newFiles.push({
            id,
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified,
            role,
            extractedText: text,
            extractionMethod: "csv",
            canonicalRecipe,
            recipeIntelligence:
              role === "recipe"
                ? {
                    needsReview: true,
                    confidence: "low",
                    source: "ocr",
                  }
                : undefined,
          });
        } catch {
          const canonicalRecipe =
            role === "recipe"
              ? resolveCanonicalRecipe({
                  id,
                  extractedText: null,
                  fallbackTitle: file.name,
                })
              : undefined;
          newFiles.push({
            id,
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified,
            role,
            extractedText: null,
            extractionMethod: "csv",
            extractionError: "Failed to read CSV file",
            canonicalRecipe,
            recipeIntelligence:
              role === "recipe"
                ? {
                    needsReview: true,
                    confidence: "low",
                    source: "ocr",
                  }
                : undefined,
          });
        }
        continue;
      }

      // Images / PDFs: OCR via API
      try {
        const formData = new FormData();
        formData.append("role", role);
        formData.append("files", file);

        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        const endpoint = isPdf ? "/api/arc/ocr-pdf" : "/api/arc/ocr";

        const res = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        const result = data.files?.[0];
        const extractedText = result?.extractedText ?? null;

        // For recipe PDFs, try to split into multiple recipes
        if (role === "recipe" && isPdf && extractedText && extractedText.length > 200) {
          try {
            const splitRes = await fetch("/api/arc/split-recipes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ extractedText }),
            });
            const splitData = await splitRes.json();

            if (splitData.recipes && splitData.recipes.length > 1) {
              // Multiple recipes detected - create separate entries
              for (let i = 0; i < splitData.recipes.length; i++) {
                const recipe = splitData.recipes[i];
                const recipeId = `${file.name}-${file.size}-${file.lastModified}-recipe-${i + 1}-${crypto.randomUUID()}`;
                const recipeName = recipe.name || `${file.name} - Recipe ${i + 1}`;
                const canonicalRecipe = resolveCanonicalRecipe({
                  id: recipeId,
                  extractedText: recipe.text,
                  fallbackTitle: recipeName,
                });

                newFiles.push({
                  id: recipeId,
                  name: recipeName,
                  type: file.type,
                  size: file.size,
                  lastModified: file.lastModified,
                  role,
                  extractedText: recipe.text,
                  extractionMethod: "ocr",
                  extractionError: null,
                  canonicalRecipe,
                  recipeIntelligence: {
                    needsReview: true,
                    confidence: "low",
                    source: "ocr",
                    recipeName: recipe.name,
                  },
                  _sourceFile: file.name,
                  _recipeIndex: i + 1,
                  _totalRecipes: splitData.recipes.length,
                } as UploadedFile);
              }
              continue; // Skip the single-file logic below
            }
          } catch {
            // Split failed, fall through to single-recipe handling
          }
        }

        // Single recipe (or non-recipe, or split failed)
        const canonicalRecipe =
          role === "recipe"
            ? resolveCanonicalRecipe({
                id,
                extractedText,
                fallbackTitle: file.name,
              })
            : undefined;

        // For invoices, try to parse structured data
        let invoiceIntelligence: InvoiceIntelligence | undefined;
        if (role === "invoice" && extractedText && extractedText.length > 10) {
          try {
            const parseRes = await fetch("/api/arc/parse-invoice", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ extractedText }),
            });
            const parseData = await parseRes.json();
            if (parseData.invoice) {
              invoiceIntelligence = parseData.invoice;
            }
          } catch {
            // Parsing failed, continue without intelligence
          }
        }

        newFiles.push({
          id,
          name: file.name,
          type: file.type,
          size: file.size,
          lastModified: file.lastModified,
          role,
          extractedText,
          extractionMethod: "ocr",
          extractionError: result?.error ?? null,
          canonicalRecipe,
          invoiceIntelligence,

          // ✅ AUTHORITATIVE chef intelligence seed
          recipeIntelligence:
            role === "recipe"
              ? {
                  needsReview: true,
                  confidence: "low",
                  source: "ocr",
                }
              : undefined,
        });
      } catch (err: any) {
        const canonicalRecipe =
          role === "recipe"
            ? resolveCanonicalRecipe({
                id,
                extractedText: null,
                fallbackTitle: file.name,
              })
            : undefined;
        newFiles.push({
          id,
          name: file.name,
          type: file.type,
          size: file.size,
          lastModified: file.lastModified,
          role,
          extractedText: null,
          extractionMethod: "ocr",
          extractionError: err?.message ?? "OCR request failed",
          canonicalRecipe,
          recipeIntelligence:
            role === "recipe"
              ? {
                  needsReview: true,
                  confidence: "low",
                  source: "ocr",
                }
              : undefined,
        });
      }
    }

    setUploadedFiles((prev) => [...prev, ...newFiles]);
    setExtractingFiles(false);
  };

  fileInput.click();
}


