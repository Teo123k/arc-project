import React from "react"
import { CanonicalRecipe } from "@/app/lib/arc/recipe/resolveCanonicalRecipe"

type Props = {
  recipe?: CanonicalRecipe
}

export function RecipeRightPanel({ recipe }: Props) {
  if (!recipe) {
    return (
      <div className="h-full p-6 text-sm text-muted-foreground">
        Recipe is still processing
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">{recipe.title}</h2>
        <div className="mt-1 text-sm text-muted-foreground space-x-2">
          {recipe.cuisine?.value && <span>{recipe.cuisine.value}</span>}
          {recipe.occasion?.value && <span>• {recipe.occasion.value}</span>}
        </div>
        <div className="mt-2 text-sm">
          Servings:{" "}
          {recipe.servings.value ?? "—"}{" "}
          {recipe.servings.unit}
          {recipe.servings.inferred && (
            <span className="ml-2 text-xs text-muted-foreground">
              (inferred)
            </span>
          )}
        </div>
      </div>

      {/* Ingredients */}
      <div>
        <h3 className="font-medium mb-2">Ingredients</h3>
        <ul className="space-y-1 text-sm">
          {recipe.ingredients.map((ing, idx) => (
            <li key={idx}>
              {ing.quantity ?? ""} {ing.unit ?? ""} {ing.name}
              {ing.preparation && `, ${ing.preparation}`}
            </li>
          ))}
        </ul>
      </div>

      {/* Steps */}
      <div>
        <h3 className="font-medium mb-2">Steps</h3>
        <ol className="list-decimal pl-4 space-y-1 text-sm">
          {recipe.steps.map(step => (
            <li key={step.order}>{step.instruction}</li>
          ))}
        </ol>
      </div>

      {/* Meta */}
      <div className="pt-4 text-xs text-muted-foreground border-t">
        Confidence: {(recipe.provenance.overallConfidence * 100).toFixed(0)}%
      </div>
    </div>
  )
}
