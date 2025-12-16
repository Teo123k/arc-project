export type PersonalContext = {
  budget?: "none" | "low" | "medium" | "high"
  time?: "very_limited" | "limited" | "flexible"
  experience?: "beginner" | "intermediate" | "advanced"
  riskTolerance?: "low" | "medium" | "high"
}

let context: PersonalContext = {}

export function setPersonalContext(update: PersonalContext) {
  context = { ...context, ...update }
}

export function getPersonalContext(): PersonalContext {
  return context
}

export function hasPersonalContext(): boolean {
  return Object.keys(context).length > 0
}
