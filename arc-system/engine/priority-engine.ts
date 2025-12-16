export function evaluatePriority(intention: string, friction: string | null) {
  if (!friction) {
    return {
      level: "Low",
      score: 30,
      reason: "No friction detected — intention seems clear.",
    };
  }

  if (friction.toLowerCase().includes("money")) {
    return {
      level: "High",
      score: 90,
      reason: "Financial friction blocks execution.",
    };
  }

  if (friction.toLowerCase().includes("no audience") || friction.toLowerCase().includes("marketing")) {
    return {
      level: "Medium",
      score: 65,
      reason: "Audience building is required before execution.",
    };
  }

  return {
    level: "Medium",
    score: 50,
    reason: "General friction detected — needs clarification.",
  };
}
