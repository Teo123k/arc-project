import { NextResponse } from "next/server"

type CanonicalRecipeLike = {
  title: string
  servings?: { value: number | null; unit: "people" | "portions" }
  ingredients: Array<{ name: string; quantity: number | null; unit: string | null }>
  steps: Array<{ order: number; instruction: string }>
}

type StructuredValue<T> = {
  value: T
  confidence: number
  source: "ai"
}

type ResponseBody = {
  recipeNameStructured: StructuredValue<string>
  cuisineStructured?: StructuredValue<string>
  occasionStructured?: StructuredValue<string>
  dietaryStructured?: StructuredValue<string[]>
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      recipe: CanonicalRecipeLike
    }

    // NOTE: This endpoint is intentionally dedicated to recipe classification.
    // It returns strict JSON only. It does not create categories.
    //
    // TODO: Implement OpenAI call (using your existing server-side OpenAI wrapper, if present).
    // For now, return a safe placeholder to keep the contract stable.

    const safeTitle = body?.recipe?.title?.trim() || "Untitled Recipe"

    const out: ResponseBody = {
      recipeNameStructured: {
        value: safeTitle,
        confidence: 0.6,
        source: "ai",
      },
    }

    return NextResponse.json(out)
  } catch {
    return NextResponse.json(
      { error: "recipe-classify failed" },
      { status: 500 }
    )
  }
}







