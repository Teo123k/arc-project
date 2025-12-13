import { evaluatePriority } from "./priority-engine";
import { evaluateAction } from "./action-engine";

export async function runIntentionPipeline(input: any) {
  const intention = input.intention || null;
  const friction = input.friction || null;

  const priority = evaluatePriority(intention, friction);
  const action = evaluateAction(intention, friction);

  return {
    intention,
    friction,
    reasoning: {
      goal: "Understand the exact desire and its purpose",
      frictionAnalysis: friction || "No friction reported",
      options: [
        "Clarify the intention",
        "Identify obstacles",
        "Define next measurable action"
      ],
      bestNextStep: action.title
    },
    priority,
    action,
    status: "processed"
  };
}
